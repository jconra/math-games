// THE CABIN'S SHELL: the station's own walls, doorways, corners, floors and ceilings (kit/shell.js), drawn at a ship's
// size, and the few pieces a ship needs that the station hasn't: a slanted wall where a room meets the hull's slope,
// and a way to hang the station's wall kit on a ship wall. Sizes are the ship grid's (cabin/ship.js): 0.5 m cells,
// rooms 2.5 m to the ceiling, wall faces 0.03 m in from their wall lines.
// Frames (as the station's, on the ship grid):
//   a wall (wallRun, doorway, hullSlope) stands on its wall line: x along it, centred on x = 0; z = 0 on the line,
//     the room it faces in +z (a doorway has a face both ways); y = 0 the deck
//   a corner stands on the point where two wall lines cross, the room in +x, +z ('inside') or round it ('outside')
//   a floor or ceiling run is centred on its origin: x along it, z across it
//
//   shipSizes(o)            shell.js sizes for a ship wall: { w, h, top, depth, door, pilaster }
//   wallRun(p, o)           a run of wall: { len (2), panel (2: each panel's width, the station's; a panel costs
//                           about the same whatever its width, so wide panels keep a ship's triangles down), v ('plain' | 'dark'), top (TOP),
//                           base (true: the dark skirting), cornice (true: the slant up to the ceiling), ribs (false:
//                           a rib at each join between panels), glow (false: a light strip along the floor's edge),
//                           pilaster (true on panels 1 m wide or more) }
//   doorway(p, o)           a doorway panel, two-faced: { w (1: the panel), clear (0.8: the opening), h (2.0: the
//                           opening's height), leaves (2: two parting; 1 / -1: one sliding to +x / -x), locked (false),
//                           near (1.6: how close before it opens) }. The leaves slide on into the walls beside it: a
//                           ship builder puts wall either side, on both faces, at least as long as a leaf (two leaves:
//                           clear / 2 + 0.05 each side; one: clear + 0.05 on its side)
//   corner(p, o)            { v: 'inside' | 'outside', top }
//   floorRun(p, o)          { len (2), wid (1), v ('walk': a corridor's floor, a grated walkway down its middle with a
//                           light strip each side; 'deck', 'tread', 'grating', 'vent'), tile (1), walk (0.25: each half
//                           of the walkway) }
//   ceilingRun(p, o)        { len (2), wid (1), tile (1), lights (2: a light panel in every second tile; 1 every tile;
//                           0 none), h (ROOM) }
//   hullSlope(p, o)         the slanted wall where a room meets the hull's chamfered top corner: { len (2), y0 (2.0:
//                           where the slope leaves the wall), run (0.5: how far in it comes at the ceiling), h (ROOM),
//                           panel (2), strip (true: a light strip along its foot) }. The wall under it is a wallRun
//                           with { top: y0, cornice: false }; y0 1.67 m or higher (over the wall's dark band).
//   bulkhead(p, o)          the station's arched hatch at a ship's size, for an airlock: { w (2), clear (0.9),
//                           spring (1.5), k (0.5), skin (0.06) }
//   onWall(dst, src, o)     a station wall-kit piece (breaker, extinguisher, screen...) hung on a ship wall:
//                           { at: [x, y, z] (a point on the wall LINE, at the height the piece hangs from), face
//                           ('+z', '-z', '+x', '-x': which way the wall faces) }. FACING has the turns. A ship wall's
//                           panels stand up to 1 cm proud in places (the lower bay left of a pilaster, the upper bay
//                           right of it): a label or other flat decal goes on one of the flat bays.
import { wallPanel, rib, trim, corner as stationCorner, floorTile, ceilingTile, hatch, slabRow, band, backing, zOf, G, BAND } from '../shell.js';
import { Piece } from '../piece.js';
import { put } from '../geo.js';
import { part, placeInto } from './place.js';
import { ROOM, FACE, DEPTH } from './cabin/ship.js';

const PI = Math.PI;
export const TOP = 2.25;     // a ship wall's cornice starts here: a 0.25 m slant up to the 2.5 m ceiling
export const DOOR_H = 2.0;   // a doorway's opening
export function shipSizes(o = {}) {
  return { w: o.w ?? 2, h: o.h ?? ROOM, top: o.top ?? TOP, depth: DEPTH, pilaster: o.pilaster ?? (o.w ?? 2) >= 1, lean: o.lean ?? true, ...(o.door ? { door: o.door } : {}) };
}

// (a ship's shell is drawn COARSE, as the station's big rooms are: the same shapes with bigger steps between the
// vertices across their big faces; and without the extra rows of vertices a slab keeps near its edges for the bake, so
// a whole ship's walls stay within a phone's triangles. The bevels stay. `lean` draws a build that way, every piece it
// makes on the way included (the doorway's two faces, its leaves): while it runs, a Piece's slabs, boxes and glow
// strips are drawn without those rows unless asked for them.)
export function lean(build) {
  return (p, o) => {
    const P = Piece.prototype, was = { coarse: Piece.coarse, slab: P.slab, box: P.box, glowSlab: P.glowSlab };
    Piece.coarse = true; p.coarse = true;
    P.slab = function (s, x0, x1, y0, y1, z0, z1, opts = {}) { return was.slab.call(this, s, x0, x1, y0, y1, z0, z1, { loops: [], ...opts }); };
    P.box = function (s, size, at, rot, opts = {}) { return was.box.call(this, s, size, at, rot, { loops: [], ...opts }); };
    P.glowSlab = function (n, x0, x1, y0, y1, z0, z1, opts = {}) { return was.glowSlab.call(this, n, x0, x1, y0, y1, z0, z1, { loops: [], ...opts }); };
    try { return build(p, o); } finally { Piece.coarse = was.coarse; P.slab = was.slab; P.box = was.box; P.glowSlab = was.glowSlab; }
  };
}
// ── walls ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// one panel of wall, its skirting and its cornice (as parts, so a run of them draws each size once)
const panel = lean((p, o) => wallPanel(p, o.v, shipSizes(o)));
const trimOf = lean((p, o) => trim(p, o.v, shipSizes(o)));
const ribOf = lean((p, o) => rib(p, o.v, shipSizes(o)));
// a run's panels: whole panels of `panel` and what is left over (both on the grid), centred on x = 0
function panels(len, w) {
  const n = Math.floor(len / w + 1e-6), rest = +(len - n * w).toFixed(3), out = [];
  let x = -len / 2;
  for (let i = 0; i < n; i++) { out.push([x + w / 2, w]); x += w; }
  if (rest > 1e-3) out.push([x + rest / 2, rest]);
  return out;
}
export function wallRun(p, o = {}) {
  const { len = 2, panel: pw = 2, v = 'plain', top = TOP, base = true, cornice = true, ribs = false, glow = false } = o;
  if (top < BAND[1] + 0.15) throw new Error('kit: a ship wall\'s top (where its cornice or the hull\'s slope starts) must be 1.67 m or higher, over its dark band');
  const list = panels(len, pw);
  for (const [x, w] of list) {
    const pil = o.pilaster ?? w >= 1;
    placeInto(p, part(panel, { v, w, top, pilaster: pil }), { at: [x, 0, 0] });
    if (base) placeInto(p, part(trimOf, { v: 'base', w, top }), { at: [x, 0, 0] });
    if (glow) placeInto(p, part(trimOf, { v: 'glow', w, top }), { at: [x, 0, 0] });
    if (cornice) placeInto(p, part(trimOf, { v: 'cornice', w, top }), { at: [x, 0, 0] });
  }
  if (ribs) for (let i = 1; i < list.length; i++) placeInto(p, part(ribOf, { v: 'strip', top }), { at: [list[i][0] - list[i][1] / 2, 0, 0] });
  return p;
}

// ── doorways ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const doorway = lean(function doorway(p, o = {}) {
  const { w = 1, clear = 0.8, h = DOOR_H, leaves = 2, locked = false, near = 1.6, top = TOP } = o;
  wallPanel(p, locked ? 'locked' : 'door', shipSizes({ w, top, door: { w: clear, h, leaves, near } }));
  // the cornice along both faces, and the skirting either side of the frame where there is wall to carry it
  const side = w / 2 - (clear / 2 + 0.1);
  for (const ry of [0, PI]) {
    placeInto(p, part(trimOf, { v: 'cornice', w, top }), { rot: [0, ry, 0] });
    if (side > 0.04) for (const sx of [-1, 1]) placeInto(p, part(trimOf, { v: 'base', w: +side.toFixed(3), top }), { at: [sx * (w / 2 - side / 2), 0, 0], rot: [0, ry, 0] });
  }
  return p;
});

// ── corners ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const corner = lean(function corner(p, o = {}) { stationCorner(p, o.v || 'inside', shipSizes({ top: o.top })); return p; });

// ── floors and ceilings ─────────────────────────────────────────────────────────────────────────────────────────────
const floorOf = lean((p, o) => floorTile(p, o.v, { w: o.w, d: o.d, tex: 1, walk: o.walk }));
const ceilOf = lean((p, o) => ceilingTile(p, o.v, { w: o.w, d: o.d, h: o.h, lean: true }));
export function floorRun(p, o = {}) {
  const { len = 2, wid = 1, v = 'walk', tile = 1, walk = 0.25 } = o;
  for (const [x, w] of panels(len, tile)) {
    if (v === 'walk') {
      // two half-width tiles turned to face, their gratings meeting down the middle
      const t = part(floorOf, { v: 'walk', w, d: wid / 2, walk });
      placeInto(p, t, { at: [x, 0, wid / 4] }); placeInto(p, t, { at: [x, 0, -wid / 4], rot: [0, PI, 0] });
    } else for (const [z, d] of panels(wid, tile)) placeInto(p, part(floorOf, { v, w, d }), { at: [x, 0, z] });
  }
  return p;
}
export function ceilingRun(p, o = {}) {
  const { len = 2, wid = 1, tile = 1, lights = 2, h = ROOM } = o;
  panels(len, tile).forEach(([x, w], i) => {
    for (const [z, d] of panels(wid, tile)) placeInto(p, part(ceilOf, { v: lights && i % lights === Math.floor(lights / 2) % lights ? 'light' : 'panel', w, d, h }), { at: [x, 0, z] });
  });
  return p;
}

// ── the hull's slope ────────────────────────────────────────────────────────────────────────────────────────────────
// the station's wall panels (slabRow, its seams and band) drawn flat and tipped back: from the wall's face at y0, up
// and in to the ceiling `run` from the wall
export const hullSlope = lean(function hullSlope(p, o = {}) {
  const { len = 2, y0 = 2.0, run = 0.5, h = ROOM, panel: pw = 2, strip = true } = o;
  const Z = zOf(DEPTH), rise = h - y0, L = Math.hypot(rise, run), a = Math.atan2(run, rise), q = new Piece();
  // (drawn standing, from y = 0 to its slant length: the panels, a seam at each panel join, a dark band halfway up)
  const cuts = panels(len, pw).slice(1).map(([x, w]) => x - w / 2);
  backing(q, -len / 2, len / 2, 0, L + 0.02, Z(0.03), Z(0.07));
  slabRow(q, -len / 2 + G, len / 2 - G, 0, L * 0.45, cuts, 'white', [], { cell: 0.6 }, Z);
  q.slab('band', -len / 2 + G, len / 2 - G, L * 0.45 + G, L * 0.45 + 0.08 - G, Z(0.07), Z(0.19), { r: 0.006, skip: ['-z'], cell: 0.6 });
  slabRow(q, -len / 2 + G, len / 2 - G, L * 0.45 + 0.08, L + 0.02, cuts, 'white2', [], { cell: 0.6 }, Z);
  // its foot: a charcoal knee along the wall's top, a light strip in it washing down the wall (all of it above the
  // foot's line, so nothing swings back through the wall when it tips)
  q.slab('black', -len / 2, len / 2, 0, 0.07, Z(0.03), Z(0.3), { r: 0.008, cell: 0.6 });
  if (strip) {
    q.glowSlab('soft', -len / 2 + 0.03, len / 2 - 0.03, 0.005, 0.01, Z(0.3), Z(0.3) + 0.004);
    for (let x = -len / 2 + 0.5; x < len / 2; x += 1) q.light([x, 0.02, Z(0.3) + 0.06], 0.35, [1, 0.97, 0.92], [0, -0.7, 0.7], 3);
  }
  // tipped back about its foot (x), then set on the wall's face at y0
  for (const part_ of q.parts) { put(part_.geo, [0, 0, 0], [a, 0, 0]); put(part_.geo, [0, y0, 0]); p.parts.push(part_); }
  const c = Math.cos(a), s = Math.sin(a);
  for (const L_ of q.lights) {
    const [x, y, z] = L_.at, d = L_.dir;
    p.lights.push({ ...L_, at: [x, y0 + y * c - z * s, y * s + z * c], dir: d && [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c] });
  }
  return p;
});

// ── a bulkhead with the station's arched hatch, at a ship's size ─────────────────────────────────────────────────────
export const bulkhead = lean(function bulkhead(p, o = {}) {
  const { w = 2, clear = 0.9, spring = 1.5, k = 0.5, skin = 0.06, near = 1.8 } = o;
  hatch(p, 'arch', { hw: clear / 2, spring, half: w / 2, h: ROOM, skin, core: 0.02, k, near, portal: false, lean: true });
  return p;
});

// ── the station's wall kit on a ship wall ───────────────────────────────────────────────────────────────────────────
// (a wall-kit piece has its back at z = 0 on a wall's face: on a ship's wall that face is FACE from the wall line)
export const FACING = { '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 };
const NORMAL = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] };
export function onWall(dst, src, { at = [0, 1, 0], face = '+z' } = {}) {
  const [nx, nz] = NORMAL[face];
  return placeInto(dst, src, { at: [at[0] + nx * FACE, at[1], at[2] + nz * FACE], rot: [0, FACING[face], 0] });
}
