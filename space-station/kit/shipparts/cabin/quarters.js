// THE CREW'S QUARTERS: a bunk bed set into a wall, and a row of lockers. Both are the station's own furniture
// (furniture.js's bunk 'double' and cabinet 'tall'), sized to a ship's grid, with what sets the bunk into the wall.
// Frame: against a wall, z = 0 on the wall line (nothing behind FACE), the middle on x = 0, on the deck (y = 0).
//   bunkBed(p, o)   two bunks in an alcove: { len (2.0: along the wall, 4 cells; the mattresses come out 1.81 m),
//                   depth (1.0: out from the wall line, 2 cells), top (2.4: the alcove's head, a panel from there to the
//                   ceiling, 0.55 m over the top mattress), h (ROOM), light (true: a strip under the head lighting the
//                   top bunk), navy (true: navy blankets, as in his pictures; false: the station's orange) }
//   lockers(p, o)   { n (2), w (0.5: each, one cell), depth (0.5: out from the wall line), h (2.05) }
import { bunk, cabinet } from '../../furniture.js';
import { part, placeInto } from '../place.js';
import { lean } from '../cabin.js';
import * as THREE from 'three';
import { ROOM, FACE, NAVY, NAVY2 } from './ship.js';

// the station's bunk 'double' is 2.14 m long (its end panels, 2.25 m tall, at x = +-1.0 to 1.06, their caps to 1.07),
// 1.01 m deep (to its ladder); its mattresses are 1.94 m long
const BUNK = { len: 2.14, depth: 1.01, end: 0.07, mattress: 1.94 }, bunk2 = lean((p) => bunk(p, 'double')), tall = lean((p) => cabinet(p, 'tall'));
// how long a bunk's mattresses come out at a given length along the wall
export const mattressOf = (len) => BUNK.mattress * len / BUNK.len;
export const bunkBed = lean(function bunkBed(p, o = {}) {
  const { len = 2.0, depth = 1.0, top = 2.4, h = ROOM, light = true } = o, hl = len / 2, sx = len / BUNK.len, e = BUNK.end * sx;
  // the bunk, its back on the wall's face, its own end panels the alcove's sides (so the mattresses keep their length)
  const n0 = p.parts.length;
  placeInto(p, part(bunk2), { at: [0, 0, FACE], scale: [sx, 1, (depth - FACE - 0.01) / BUNK.depth] });
  // (the station's blankets are a warm orange; the ships' are the navy of the game's maker's pictures: each placed part
  // whose colour is that orange is painted navy, the darker folded edge darker)
  if (o.navy ?? true) for (const pt of p.parts.slice(n0)) {
    const c = pt.geo.attributes.color; if (pt.mat !== 'solid' || !c) continue;
    const r = c.getX(0), g = c.getY(0), b = c.getZ(0); if (!(r > 2.5 * b && r > 1.4 * g && r > 0.1)) continue;
    const to = new THREE.Color(r > 0.35 ? NAVY.c : NAVY2.c);
    for (let i = 0; i < c.count; i++) c.setXYZ(i, to.r, to.g, to.b);
  }
  // the alcove: the end panels carried on up to the ceiling, a charcoal edge down each front; a head panel across the
  // top with the alcove's own ceiling behind it (so the room's cornice never shows in it), a strip light under it
  for (const sg of [-1, 1]) {
    p.slab('white', sg > 0 ? hl - e : -hl, sg > 0 ? hl : -hl + e, 2.25, h, FACE, depth - 0.02, { r: 0.008, cell: 0.6 });
    p.slab('black', sg > 0 ? hl - e - 0.005 : -hl - 0.005, sg > 0 ? hl + 0.005 : -hl + e + 0.005, 0, h, depth - 0.03, depth, { r: 0.01, cell: 0.8 });
  }
  p.slab('white2', -hl + e, hl - e, top, h, depth - 0.06, depth - 0.02, { r: 0.008, cell: 0.6 });
  p.slab('black', -hl + e, hl - e, top - 0.04, top, FACE + 0.12, depth - 0.02, { r: 0.01, cell: 0.8 });
  p.slab('dark', -hl + e, hl - e, top, top + 0.02, FACE, depth - 0.06, { r: 0, cell: 0.8, skip: ['+y'] });
  if (light) {
    p.glowSlab('soft', -hl + e + 0.06, hl - e - 0.06, top - 0.045, top - 0.04, depth - 0.2, depth - 0.12);
    p.light([0, top - 0.12, depth - 0.3], 0.5, [1, 0.93, 0.82], [0, -1, 0], 2.4);
    // and one along the underside of the top bunk, over the lower one (the station bunk's top base starts at 1.32)
    const zf = FACE + (depth - FACE - 0.01) * 0.85;
    p.slab('black', -hl + e + 0.06, hl - e - 0.06, 1.3, 1.32, zf - 0.05, zf, { r: 0.004 }); p.glowSlab('soft', -hl + e + 0.08, hl - e - 0.08, 1.296, 1.3, zf - 0.04, zf - 0.01);
    p.light([0, 1.2, zf - 0.2], 0.4, [1, 0.93, 0.82], [0, -1, 0], 2);
  }
  return p;
});
// the station's tall locker is 0.6 m wide, 0.55 deep with doors and handles out to 0.6
const LOCKER = { w: 0.6, depth: 0.6 };
export function lockers(p, o = {}) {
  const { n = 2, w = 0.5, depth = 0.5, h = 2.05 } = o;
  for (let i = 0; i < n; i++) placeInto(p, part(tall), { at: [(i - (n - 1) / 2) * w, 0, FACE], scale: [(w - 0.01) / LOCKER.w, h / 2.05, (depth - FACE) / LOCKER.depth] });
  return p;
}
