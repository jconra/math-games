// MINER A's OWN PARTS: the few things only the miner (kit/rooms/ship-miner.json) needs, each made from the reusable
// ship parts (kit/shipparts/) called with the miner's own sizes and put together with place.js, as the parts' notes
// ask a ship to. They are catalog pieces (group 'Ships'), so the ship's layout file can place them by name.
//   minerCockpit   the cockpit family's two-seat cockpit (cockpit/set.js) fitted to the miner's windscreen: its foot
//                  1.5 m over the deck and 1.5 m ahead of the seats, 34 degrees (the hull's 'bluff' nose). As sheet
//                  2's: the two seats, the dashboard, their pedals and the throttle pedestal between them. Not the
//                  engineer behind (the miner's has his own room, on the arms' cameras), nor the side consoles, locker
//                  and handholds (they stand against a cockpit's side walls; the miner's cockpit is the hull's whole
//                  width, its walls the hull's inside), nor the overhead panel (it hangs from a flat 2.5 m ceiling;
//                  over the miner's seats is the nose's sloping roof). Frame: the seats' middles on z = 0, the nose
//                  toward +z, the deck at y = 0 (cockpitPlan's).
//   minerCans      the ore canisters, two stacked (outside/jobgear.js canister), 1.4 m across so a stack stands within the
//                  hull's height with its dark body showing round it, as his picture's, 5.2 m long; 'port' as drawn
//                  (its cradle's feet toward -x, the hull), 'starboard' the same mirrored. Frame: the lower drum's axis
//                  at the origin.
//   minerTanks     sheet 2's gas tanks in engineering: two of the canisters small (0.5 m across, 1.1 m long), one over
//                  the other, lying along a wall. Frame: a wall fitting's (z = 0 on the wall line, facing +z, along x);
//                  the cradle's feet go back through the wall to the hull behind it.
//   minerChute     sheet 2's ore chute: a plain charcoal duct under the belly from the scoop's back to the canisters,
//                  branching under the body to each lower canister, as sheet 2 draws it (the scoop's rock to the
//                  canisters; the upper ones fill from the lower). Frame: the ship's own (CHUTE: ship metres, z along
//                  from the tail face, y from the deck): place it at the tail face's middle, on the deck.
import { Piece } from '../piece.js';
import { part, placeInto } from '../shipparts/place.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';
import { canister } from '../shipparts/outside/jobgear.js';
import { SHIP } from '../shipparts/palette.js';
import { Acc } from '../shipparts/outside/facet.js';
import { box, bar } from '../shipparts/outside/shapes.js';

const PI = Math.PI;
// the miner's windscreen, from the cockpit's seats (the layout puts the seats 1.5 m behind its foot): from the ceiling
// over the seats down to its foot 1.5 m over the deck (the hull's grid steps give 1.0 or 1.5 m; at 1.0 the dashboard's
// hood would stand in the glass)
export const MINER_CANOPY = { y: 1.5, z: 1.5, slope: Math.atan2(1.0, 1.5) };
export const MINER_COCKPIT = { seats: 2, canopy: MINER_CANOPY, wallX: 1.25 };
export function minerCockpit(p, o = {}) {
  const plan = cockpitPlan({ ...MINER_COCKPIT, ...o });
  for (const it of plan.items) {
    if (/^(engineer|side|locker|handhold|overhead)/.test(it.name)) continue;
    placeInto(p, part(BUILDS[it.build], it.opts), { at: it.at, rot: it.rot, scale: it.scale });
  }
  return p;
}

export const MINER_CAN = { r: 0.7, len: 5.2, stack: 2 };
export function minerCans(p, o = {}) {
  const q = new Piece(); canister(q, { ...MINER_CAN });
  return placeInto(p, q, { scale: o.mirror ? [-1, 1, 1] : 1 });
}

export const MINER_TANK = { r: 0.25, len: 1.1, bands: 2, stack: 2 };
export function minerTanks(p) {
  // (the canister lies along its own z with its cradle toward -x: turned so it lies along x, the cradle toward -z,
  // its axis 0.34 m out from the wall line, the lower drum 0.4 m up)
  return placeInto(p, part(canister, MINER_TANK), { at: [0, 0.4, 0.34], rot: [0, -PI / 2, 0] });
}

// (the duct: 0.5 m wide and 0.3 m deep under the 0.5 m-deep belly, starboard of the middle line, clear of the lift's
// hatch; up the chin to the scoop's back; the branches between the middle and back landing legs, rising to the lower
// canisters' undersides)
export const CHUTE = { x0: -0.5, x1: 0.0, top: -0.5, h: 0.3, back: 4.4, chin: 14.5, front: 15.6, frontTop: -0.13, can: 3.64, canBottom: -0.42, bw: 0.4 };
export function minerChute(p) {
  const C = CHUTE, a = new Acc(), T = SHIP.trim, xm = (C.x0 + C.x1) / 2, w = C.x1 - C.x0, b0 = C.top - C.h;
  box(a, T, [C.x0, C.x1], [b0, C.top], [C.back - C.bw / 2, C.chin]);
  bar(a, T, [xm, C.top - C.h / 2, C.chin - 0.02], [xm, C.frontTop - C.h / 2, C.front], w, C.h);
  for (const sg of [1, -1]) {
    const xa = sg > 0 ? C.x1 : C.x0, xb = sg * (C.can + 0.15);
    box(a, T, [Math.min(xa, xb), Math.max(xa, xb)], [b0, C.top], [C.back - C.bw / 2, C.back + C.bw / 2]);
    box(a, T, [sg * C.can - 0.2, sg * C.can + 0.2].sort((u, v) => u - v), [b0, C.canBottom], [C.back - C.bw / 2, C.back + C.bw / 2]);
  }
  return a.flush(p);
}

// his canopy's frames: a mullion down the middle of the windscreen, an off-white bar in a charcoal edge, on the glass's
// outside. Frame: its top end at the origin (the windscreen's top edge, the middle line), running down and forward
// `len` metres at `slope` radians below level, to the foot
export function minerMullion(p, o = {}) {
  const len = o.len ?? 1.8, slope = o.slope ?? Math.atan2(1.0, 1.5), a = new Acc(), c = Math.cos(slope), sn = Math.sin(slope);
  const end = [0, -len * sn, len * c], n = [0, c, sn];   // (the glass's outward normal)
  const off = (q, k) => [q[0] + n[0] * k, q[1] + n[1] * k, q[2] + n[2] * k];
  bar(a, SHIP.frame, off([0, 0, 0], 0.03), off(end, 0.03), 0.09, 0.06);
  bar(a, SHIP.hull, off([0, 0, 0], 0.065), off(end, 0.065), 0.05, 0.02);
  return a.flush(p);
}
// his bold black-and-yellow hazard plate on the crew hull's side: the kit's hazard stripes on a charcoal backing.
// Frame: on a flat panel's face, facing +z, its middle at the origin
export function minerHazard(p, o = {}) {
  const w = o.w ?? 1.6, h = o.h ?? 0.36, a = new Acc();
  box(a, SHIP.trim, [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.02]);
  a.flush(p);
  p.decal('hazard', w - 0.06, h - 0.06, [0, 0, 0.022], null, '#d9a21e');
  return p;
}

const G = 'Ships';
export const MINER = {
  minerCockpit: { name: 'Miner A: cockpit', group: G, at: 'free', foot: [3, 2.5, 3], variants: ['two seats'], build: (p) => minerCockpit(p) },
  minerCans: { name: 'Miner A: ore canisters', group: G, at: 'free', foot: [2.2, 3.4, 5.6], variants: ['port', 'starboard'], build: (p, v) => minerCans(p, { mirror: v === 'starboard' }) },
  minerTanks: { name: 'Miner A: gas tanks', group: G, at: 'free', foot: [1.4, 1.2, 0.7], variants: ['pair'], build: (p) => minerTanks(p) },
  minerChute: { name: 'Miner A: ore chute', group: G, at: 'free', foot: [7.6, 0.8, 11.5], variants: ['chute'], build: (p) => minerChute(p) },
  minerMullion: { name: 'Miner A: windscreen mullion', group: G, at: 'free', foot: [0.2, 1.1, 1.6], variants: ['middle'], build: (p) => minerMullion(p) },
  minerHazard: { name: 'Miner A: hazard plate', group: G, at: 'free', foot: [1.8, 0.5, 0.05], variants: ['plate', 'big'], build: (p, v) => minerHazard(p, v === 'big' ? { w: 1.8, h: 0.5 } : {}) },
};
