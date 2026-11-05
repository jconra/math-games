// MEDIC A (layout id 'ship-medic'): the few parts only this ship needs, written like the ship parts (kit/shipparts/).
// Everything else on the ship is a catalog part placed by its layout file (kit/rooms/ship-medic.json, written by
// ~/pw/space-math/rigs/ships/ship-medic/make.mjs).
//   medicCockpit(p, o)   the flight deck's fittings, under the medic's nose (hullCap 'nose medic medic'): the cockpit
//                        family's two-seat cockpit (cockpit/set.js cockpitPlan) fitted to this nose. Its windscreen's
//                        foot is 1.0 m up and 1.5 m ahead of the seats, sloping at 45 degrees; the dashboard reaches 0.6 m
//                        toward it and stops short of the nose's rising belly. The whole set stands o.shift (0.25 m) to
//                        port, so the doorway from the corridor (a quarter metre to port of the middle) opens on the
//                        throttle pedestal between the seats. The engineer sits outboard on the port side, beside the
//                        pilots, facing aft to the station on the aft wall (as sheet 2 draws it); that side's console is
//                        left out, so his seat is open to the cabin; the starboard one is the short console. A locker on
//                        the aft wall to starboard. No overhead panel (the roof comes down to 2.3 m over the seats), no
//                        handholds (no side walls here: the hull is the cockpit's wall) and no pedals (out of sight
//                        under the dash: the triangles go to the rooms).
//     Frame: the flight deck's aft wall line at z = 0 (the nose cap's start), the hull's middle line at x = 0, the deck
//     at y = 0, the nose toward +z (port, the ship's left, is +x). The seats' middles are 1.0 m ahead of the wall.
//     o.engX (2.0: the engineer's station and seat, across), o.seatZ (1.0), o.shift (0.25)
//   jamb(p, o)           a hull opening's lining carried on from the back of the hull's own (0.3 m deep) to the face of
//                        the cabin wall one cell in (0.53 m from the hull's face), so a doorway or a ramp's mouth reads
//                        as one opening through hull and wall. Charcoal sides and head like the hull's lining, a grey
//                        sill, and over a door lower than the room an off-white lintel up to the ceiling with the
//                        cabin wall's cornice, flush with the walls either side.
//     Frame: the hull opening's (outside/hull.js): its foot's middle on the hull's outer face, facing out (+z); it
//     runs back into the ship (-z). o.w (the opening's width), o.h (its height), o.top (the room's height, 2.5), o.lip
//     (a lip round its sides and head at the hull's lining, that wide: 'mouth' has 0.07 m, over the shut ramp's edges)
//     (The hull's door leaf slides into the hull 0.27 to 0.3 m in, in front of this lining: the two never meet.)
//   tanks(p, o)          the engine room's two upright tanks (sheet 2's), piped up into the ceiling and down into the
//                        deck, as the reactor drum's open pipe end is (the two joined under the floor, not across it)
import { part, placeInto } from '../shipparts/place.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';
import { lean, shipSizes, TOP } from '../shipparts/cabin.js';
import { trim } from '../shell.js';
import { pipe } from '../wallkit.js';
import { SHIP } from '../shipparts/palette.js';
import { ROOM, FACE, CELL } from '../shipparts/cabin/ship.js';

const PI = Math.PI;
export const DECK_TO_FOOT = { y: 1.0, z: 1.5 };   // the medic nose's windscreen foot, from the seats (sections.js: stage 2 ends at level 2, 2.5 m into the cap)

// ── the flight deck ──
export function medicPlan(o = {}) {
  const seatZ = o.seatZ ?? 1.0, engX = o.engX ?? 2.0, shift = o.shift ?? 0.25;
  const plan = cockpitPlan({ seats: 2, canopy: { y: DECK_TO_FOOT.y, z: DECK_TO_FOOT.z, slope: PI / 4 }, dash: { depth: 0.6, deckY: 1.15 }, side: { len: 0.5, pod: false } });
  const items = [];
  for (const it of plan.items) {
    if (/^overhead|^handhold|^pedals|^side port/.test(it.name)) continue;
    const at = [it.at[0] + shift, it.at[1], it.at[2] + seatZ];
    if (it.name === 'engineer') { at[0] = engX; at[2] = 1.0; }   // (beside the pilots, 0.5 m from the station's front)
    if (it.name === 'engineer station') { at[0] = engX; at[2] = 0; }
    if (it.name === 'locker') { items.push({ ...it, at: [-1.75, 0, 0], rot: [0, 0, 0] }); continue; }
    items.push({ ...it, at });
  }
  return { ...plan, items, seatZ };
}
export function medicCockpit(p, o = {}) {
  for (const it of medicPlan(o).items) placeInto(p, part(BUILDS[it.build], it.opts), { at: it.at, rot: it.rot, scale: it.scale });
  return p;
}

// ── a hull opening carried through to the cabin wall ──
const D0 = 0.3;   // (the hull's lining ends 0.3 m in; the cabin wall's face is a cell plus FACE in)
const box = (p, surf, x0, x1, y0, y1, z0, z1) => p.slab(surf, x0, x1, y0, y1, z0, z1, { r: 0.004, loops: [], cell: 9 });
export const jamb = lean(function jamb(p, o = {}) {
  const { w = 1.0, h = 2.0, top = ROOM } = o, hw = w / 2, t = 0.025, d1 = CELL + FACE;
  // the sides and the head, charcoal, just behind the hull's own lining (the head even where the opening is the room's
  // height: it closes the gap over it between the ceiling's edge and the hull); a grey sill
  for (const s of [-1, 1]) box(p, SHIP.trim, s > 0 ? hw : -hw - t, s > 0 ? hw + t : -hw, -0.012, Math.min(h, top), -d1, -D0);
  box(p, SHIP.trim, -hw - t, hw + t, h, h + t, -d1, -D0);
  box(p, SHIP.grey, -hw - t, hw + t, -0.012, 0.004, -d1, -D0);   // (under the sides too: no pinhole at the corners)
  // (a lip round its sides and head where it meets the hull's lining, o.lip wide: a ramp stands in its mouth with a
  // few centimetres to spare all round, and the lip closes those slits to the eye from inside)
  if (o.lip) {
    for (const s of [-1, 1]) box(p, SHIP.trim, s > 0 ? hw - o.lip : -hw, s > 0 ? hw : -hw + o.lip, 0.02, h, -D0 - 0.035, -D0);
    box(p, SHIP.trim, -hw, hw, h - o.lip, h, -D0 - 0.035, -D0);
  }
  if (h < top - 0.01) {
    // over a door: a lintel on the walls' face up to the ceiling, the cornice along it as the walls' own
    box(p, 'white', -hw - t, hw + t, h, TOP, -d1 - 0.012, -d1 + 0.03);   // (overlapping the head, so no slit shows between them)
    const q = new (p.constructor)(); trim(q, 'cornice', shipSizes({ w: w + 2 * t }));
    for (const pt of q.parts) { pt.geo.rotateY(PI); pt.geo.translate(0, 0, -CELL); p.parts.push(pt); }
  }
  return p;
});

// ── the engine room's tanks (sheet 2's: two upright tanks beside the reactor) ──
// two pale upright tanks on a charcoal plinth, charcoal domed ends, two dark bands and a yellow one each, a gauge; a
// pipe up from each into the ceiling; a stub out of the first tank's side turning down into the deck, and a drop from
// the reactor drum's open pipe end (o.reach metres from the tanks' middle, at its height) down into the deck: the two
// are joined under the floor, so the walkway between them stays clear. Frame: free-standing, centred, on the deck; the
// tanks side by side along x.
export const tanks = lean(function tanks(p, o = {}) {
  const { r = 0.38, h = 1.9, gap = 0.9, ceil = ROOM, pipeY = 0.7, reach = 1.6 } = o;
  p.slab('gun', -gap / 2 - r - 0.08, gap / 2 + r + 0.08, 0, 0.1, -r - 0.08, r + 0.08, { r: 0.012 });
  for (const sx of [-1, 1]) {
    const x = sx * gap / 2;
    p.lathe('white2', [[0.001, 0.1], [r * 0.7, 0.1], [r, 0.24], [r, h - 0.14], [r * 0.7, h], [0.001, h]], 16, [x, 0, 0]);
    for (const y of [0.32, h - 0.32]) p.cyl('black', r + 0.012, 0.06, [x, y, 0], null, 16);
    p.cyl('yellow', r + 0.01, 0.1, [x, h * 0.55, 0], null, 16);
    p.cyl('black', 0.07, 0.03, [x, 1.2, r + 0.01], [PI / 2, 0, 0], 12); p.cyl('white', 0.055, 0.032, [x, 1.2, r + 0.012], [PI / 2, 0, 0], 12);
    // (a pipe up into the ceiling)
    placeInto(p, part(pipe, 'straight'), { at: [x, (h + ceil) / 2, 0], rot: [0, 0, PI / 2], scale: [(ceil - h) / 2, 1, 1] });
    placeInto(p, part(pipe, 'sleeve'), { at: [x, h + 0.02, 0], rot: [0, 0, PI / 2] });
  }
  // (down into the deck: from the drum's pipe end, and from a short stub out of the first tank's side; a collar where
  // each meets the deck)
  const x0 = -gap / 2 - r + 0.02, xs = x0 - 0.25, drop = (x) => {
    placeInto(p, part(pipe, 'straight'), { at: [x, pipeY / 2, 0], rot: [0, 0, PI / 2], scale: [pipeY / 2, 1, 1] });
    placeInto(p, part(pipe, 'sleeve'), { at: [x, 0.03, 0], rot: [0, 0, PI / 2] });
  };
  placeInto(p, part(pipe, 'straight'), { at: [(x0 + xs) / 2, pipeY, 0], scale: [Math.abs(xs - x0) / 2, 1, 1] });
  placeInto(p, part(pipe, 'flange'), { at: [x0 - 0.05, pipeY, 0] });
  drop(xs); drop(-reach);
  return p;
});

// ── the catalog (group 'Ships': not on the Kit Lab's part tabs; the ship's layout file names them) ──
const JAMBS = { door: { w: 1.0, h: 2.0 }, mouth: { w: 3.0, h: 2.5, lip: 0.07 } };
export const MEDIC = {
  medicCockpit: { name: 'Medic A flight deck', group: 'Ships', at: 'free', variants: ['flight deck'], foot: [3.5, 1.6, 4.0], build: (p) => medicCockpit(p) },
  medicJamb: { name: 'Opening through to the cabin wall', group: 'Ships', at: 'free', variants: Object.keys(JAMBS), foot: [3.2, 2.5, 0.6], build: (p, v) => jamb(p, JAMBS[v]) },
  medicTanks: { name: 'Engine room tanks', group: 'Ships', at: 'free', variants: ['two'], foot: [1.8, 2.5, 0.9], build: (p) => tanks(p) },
};
