// THE SHIPS THAT FLY, EACH ONLY ITS DATA: the plain part of the one shared ship piece (no page and no three.js, so node
// tests it: tests/fleet.test.mjs).
//
// THE GAME'S MAKER (2026-11-19): "Yeah I was hoping that the ships will basically all fly the same and share the same
// class so that we don't have a lot of repetitive work and code." And, of walking aboard while it flies: "We already
// have walking on the ship. In order to walk on it while it flies wouldn't we just need to add its position and
// rotation with the player?"
//
// SO ONE PIECE FLIES EVERY SHIP, and a ship is its data:
//   - ITS KIT (kit/ships/<ship>-built.js): what it is built of. The shared piece reads from there its deck and cockpit
//     (src/boarding.js SHIPS: `lab`, `cockpit`), its ways in (its doors that come down to the floor, or a lift), its
//     engine's nozzles, their jets' look and its thruster pods if it has any (boarding's `flight`, from the kit's own
//     jetNozzles, JET, DECK and POD_JET), and its legs (they stay down as it flies, the Miner's too).
//   - ONE ENTRY HERE (SHIPS below), every one in the same shape: its name; where it is parked (its hangar, which way
//     its nose points there; its pad is the station file's); its shape, as a few boxes (what it bumps by when flown,
//     what is bumped and shoved when it is parked and another ship comes in; the small model in the landing guide);
//     how high it is carried through its bay; its two views (the pilot's eyes, worked out from the pilot's seat of its
//     blueprint over its cockpit's floor, and where they look; the view from behind); its dashboard's display in front
//     of the pilot; its voice (src/voices.js SHIP_CLIPS, by its id).
// From those, flightOf(id) is what the flight model flies (src/flymodel.js: makeShip(cfg)) and othersOf(id) the ships
// parked in the other hangars as that ship meets them (src/visit.js). The rest of the shared piece: src/flying.js (the
// keys, the mouse and the sticks, the two views, the buttons, the guide, the ship's voice), src/shiphull.js (its hull
// drawn where it is flown, its pods turned and fired, its engine's glow, the air blown down under it), src/boarding.js
// (boarded and walked, flown with its cabin), src/visit.js (in another ship's hangar).
//
// A FOURTH SHIP (the Hauler's kit is made to the same shape): its line in boarding.js SHIPS (its blueprint, its ways in,
// `flight` from its kit), its clips in voices.js SHIP_CLIPS, its room and pad in the station file (in a hangar of its
// own), and one more entry here.
import { HANGARS, DOOR } from '../kit/outside-plan.js';
import { bayOf } from './flysolid.js';

// EACH HANGAR'S CEILING over its bay, as a flown ship feels it (m): the Miner's hangar has the crane's rail at 8.5 m;
// the other two have nothing lower than their bay door's lintel (9 m: their roof trusses' lamps hang at 9.4 m).
// (A ship flown into ANOTHER ship's hangar feels it at 8.4 m, as the Miner always has: othersOf below.)
export const CEILING = { 'hangar-miner': 8.4, hangar: DOOR.h, 'hangar-medic': DOOR.h };

// the pad's middle of each hangar's ship (the station file's places.ships; a test holds them together)
const padOf = (i) => [42.3, 0, HANGARS[i].z];

// ── THE SHIPS ──
// Each entry, the same shape (frames: the ship's own [ahead, up, right], metres, its middle the point of it that stands
// on its pad's middle; the views in its kit's frame: x to port, y up from its ground line, z to the nose):
//   id, name     the station file's room is 'ship-' + id; its hangar is HANGARS[hangar]
//   nose         which way its nose points as it is parked: 1 out of the bay door, -1 in
//   boxes        its shape: { a: [from, to] along it, r its half width, h how tall from the floor } (nothing fits under
//                a wing); measured from the game's own walls (~/pw/space-math/rigs/flying-3/shapes.cjs). The Miner
//                is one box, as it always was. The points it bumps by are each box's corners and edges (pointsOf).
//   model        the small model in the landing guide: [from, to along it, from, to across it, from, to up, part]
//   hover, low   how high the autopilot carries it through its bay, and over its pad before it comes down (m): its top
//                then under its hangar's ceiling and its door's lintel, its belly its skin (src/flysolid.js SKIN) over
//                the door's sill
//   seat         the pilot's eyes and where they look (src/flymodel.js MINER has the words); the other seat is the same
//                across the ship
//   behind       the view from behind
//   dash         THE DASHBOARD'S DISPLAY in front of the pilot (src/dash.js, src/flying.js), ALONG THE DASHBOARD'S
//                CURVE (the game's maker, DASH1-3: "If that dashboard is curved, the the tiny ship should also be
//                curved"): `arc`, the curve's middle (x = 0, z = arc: the middle of the dashboard's arc, its kit's
//                shipparts/cockpit/bank.js); its foot's middle, `at` (on the curve: its three screens stand along the
//                circle through it, each turned to face the middle); how long it is along the curve and how tall (m),
//                and how far its top leans back toward the nose (`lean`, radians from upright): on the dashboard's top
//                under the windscreen (or on its face, where it has no top in view), in the seat's view below the window
//                and clear of the corners' buttons and help, facing the pilot. Where the ship's kit stands its life
//                support and the screen beside it up on the top (COCKPIT.dash.bank: the game's maker, DASH1-3, C), the
//                display stands between them, at their level, on their curve. `tall`: the same on a screen held
//                upright (a phone), where the view from the seat is narrower and looks lower (src/flying.js aim):
//                above a phone's buttons; none, the same display. `rider`: in front of the other seat, for a crew
//                member riding there (src/flying.js: pilot false), with its own `tall`; none: the pilot's across the
//                ship. Measured from each cockpit's own surfaces (~/pw/space-math/rigs/dashboard-1/probe.cjs) and its
//                kit's row (~/pw/space-math/rigs/dashboard-2/)
//   floor        where on its hangar's floor it may be set down by hand and got out of (null: anywhere on it). The
//                Miner's is where the crane can get at its canisters
//   shove        parked, and rammed by another ship: how heavy it is beside the flown ship (which is 1) and how hard it
//                is to turn (a radius, m); null: it is not moved. The Miner is shoved like the other two (the game's
//                maker, 2026-11-20, SHIP2-2 B: "Shove it like the other two, with its canisters riding on it. The crane
//                takes them off wherever it ends up, the same as when you land crooked."): its canisters ride on it and
//                its crane works from where it ends up (src/crane.js shove, src/visit.js), and it slides only about its
//                `floor` (below), the floor the crane can unload it on
//   voice        its clips in src/voices.js SHIP_CLIPS
//   claw         (the Miner's) where its claw's hand holds a rock
// The views for the Explorer and the Medic: the Miner's own seen from each one's pilot's seat (the eyes 1.27 m over
// the cockpit's floor, over the middle of the seat's cushion; the look the same way and as far as the Miner's), and
// the Miner's view from behind (the three are much of a size).
export const SHIPS = [
  {
    id: 'miner', name: 'Miner', hangar: 0, nose: 1,
    // (15.5 m long, 6.3 m wide and 5.1 m tall on its legs, its middle 1.2 m ahead of the middle of its length)
    boxes: [{ a: [-9.0, 6.8], r: 3.3, h: 5.1 }],
    model: [[-8.2, 2.5, -2.2, 2.2, 1.6, 4.4, 'body'], [2.5, 5.2, -1.6, 1.6, 1.9, 4.0, 'body'], [5.2, 6.8, -0.9, 0.9, 2.1, 3.4, 'nose'], [3.0, 5.0, -1.1, 1.1, 4.0, 4.5, 'glass'],
      [-5.4, -0.6, 2.2, 3.3, 1.7, 4.2, 'pod'], [-5.4, -0.6, -3.3, -2.2, 1.7, 4.2, 'pod'], [-9.0, -8.2, -1.4, 1.4, 2.0, 4.0, 'engine'],
      [-6.3, -5.9, 2.2, 2.6, 0, 1.7, 'leg'], [-6.3, -5.9, -2.6, -2.2, 0, 1.7, 'leg'], [2.8, 3.2, 1.7, 2.1, 0, 1.9, 'leg'], [2.8, 3.2, -2.1, -1.7, 0, 1.9, 'leg']],
    // (its top then 1.3 m under the door's lintel and 0.7 m under the crane's rail; the game's own landing is at 3 m
    // and 2 m: src/crane.js LANDING)
    hover: 2.6, low: 2.0,
    seat: { eye: [0.5, 3.71, 4.14], look: [0.1, 3.05, 12], lookPanel: [-1.7, 3.0, 12], lookTall: [0.2, 2.6, 12], lookTallPanel: [0.2, -1.6, 12], fov: 62, fovTall: 78 },
    behind: { back: 27, up: 8.5, ups: [8.5, 5.6, 3.4], look: [0, 3.2, 3], fov: 60, fovTall: 74 },
    // (standing on the top of its dashboard, 0.8 m ahead of the eyes, between its life support and its terminal (its
    // kit's COCKPIT_BANK); held upright, further along the top, its foot above those two screens as that view sees
    // them; riding in the other seat, beyond the terminal and a little further along the top, so that seat's view (its
    // look is the pilot's: src/flying.js aim) has it above a phone's help tab)
    dash: { arc: 2.26625, at: [0.2889, 3.256, 4.9746], w: 0.6249, h: 0.1934, lean: 0.4, tall: { at: [0.4524, 3.3217, 5.256], w: 0.6282, h: 0.1944, lean: 0.31 },
      rider: { at: [-0.5978, 3.2735, 5.0055], w: 0.5433, h: 0.1682, lean: 0.4, tall: { at: [-0.5118, 3.3217, 5.2464], w: 0.5079, h: 0.1572, lean: 0.31 } } },
    // (src/flymodel.js MINER.floor has the words: the crane's rails, the rack, the cart)
    floor: { x: [23.5, 56.9], z: [HANGARS[0].z - 9.9, HANGARS[0].z + 9.3] },
    shove: { mass: 2, gyr: 4 }, voice: 'miner',
    claw: [8.54, 2.94, 0],
  },
  {
    id: 'explorer', name: 'Explorer', hangar: 1, nose: 1,
    // (its body with its two tail booms, the taper of its nose in two steps, its wings)
    boxes: [{ a: [-8.7, 4.0], r: 3.4, h: 6.3 }, { a: [4.0, 6.5], r: 2.4, h: 5.2 }, { a: [6.5, 8.7], r: 1.3, h: 3.8 }, { a: [-6.3, -1.7], r: 6.6, h: 2.7 }],
    model: [[-8.7, 4.0, -3.4, 3.4, 0.9, 6.3, 'body'], [4.0, 6.5, -2.4, 2.4, 1.2, 5.2, 'body'], [6.5, 8.7, -1.3, 1.3, 1.6, 3.8, 'nose'], [-6.3, -1.7, -6.6, 6.6, 1.4, 2.7, 'pod']],
    // (its top, 6.3 m, then 0.9 m under the lintel)
    hover: 1.8, low: 1.4,
    // (it looks a little higher than the Miner does, so more is seen out of the window and less of its tall dashboard:
    // the game's maker, SHIP2-4, "Look a little higher in the Explorer")
    seat: { eye: [0.5, 3.31, 4.875], look: [0.1, 3.2, 12.735], lookPanel: [-1.7, 3.15, 12.735], lookTall: [0.2, 2.75, 12.735], lookTallPanel: [0.2, -1.45, 12.735], fov: 62, fovTall: 78 },
    behind: { back: 27, up: 8.5, ups: [8.5, 5.6, 3.4], look: [0, 3.2, 3], fov: 60, fovTall: 74 },
    // (its dashboard has no empty top: its tall face of screens is in the seat's view, so the display stands on the face
    // in front of the pilot, its foot on the screen there, leaning back less than the face, its top just in front of
    // the hood, turned with the face's curve; held upright, none of the face is above a phone's buttons, so it stands
    // on the hood's top at the windscreen's foot, over the bottom of the window)
    // (riding in the other seat, across the ship, on its face's other screen; held upright, a little nearer the middle,
    // as that seat's view looks where the pilot's does)
    dash: { arc: 1.94167, at: [0.465, 2.99, 5.578], w: 0.485, h: 0.15, lean: 0.38, tall: { at: [0.47, 3.098, 5.696], w: 0.5, h: 0.155, lean: 0.17 },
      rider: { at: [-0.465, 2.99, 5.578], w: 0.485, h: 0.15, lean: 0.38, tall: { at: [-0.4, 3.098, 5.7041], w: 0.5, h: 0.155, lean: 0.17 } } },
    floor: null, shove: { mass: 2, gyr: 4 }, voice: 'explorer',
  },
  {
    id: 'medic', name: 'Medic', hangar: 2, nose: -1,
    // (its body, its tail fin, the pods on its sides by the ramps, its nose in two steps)
    boxes: [{ a: [-8.8, 4.5], r: 3.2, h: 6.3 }, { a: [-8.8, -6.0], r: 1.3, h: 7.5 }, { a: [-5.7, -2.9], r: 3.9, h: 2.7 }, { a: [4.5, 6.6], r: 2.6, h: 4.7 }, { a: [6.6, 8.75], r: 1.6, h: 3.8 }],
    model: [[-8.8, 4.5, -3.2, 3.2, 0.9, 6.3, 'body'], [-8.8, -6.0, -0.4, 0.4, 6.3, 7.5, 'body'], [-5.7, -2.9, -3.9, 3.9, 0.9, 2.7, 'pod'], [4.5, 6.6, -2.6, 2.6, 1.2, 4.7, 'body'], [6.6, 8.75, -1.6, 1.6, 1.6, 3.8, 'nose']],
    // (it is carried low: its tail fin, 7.5 m, leaves only 1.5 m of its 9 m door; carried at 1.45 m its belly keeps its
    // skin off the door's sill (as the flying feels it, about half a metre high) and its fin is 5 cm under the lintel)
    hover: 1.45, low: 1.0,
    seat: { eye: [0.625, 3.81, 5.375], look: [0.225, 3.15, 13.235], lookPanel: [-1.575, 3.1, 13.235], lookTall: [0.325, 2.7, 13.235], lookTallPanel: [0.325, -1.5, 13.235], fov: 62, fovTall: 78 },
    behind: { back: 27, up: 8.5, ups: [8.5, 5.6, 3.4], look: [0, 3.2, 3], fov: 60, fovTall: 74 },
    // (standing on the top of its dashboard, a metre ahead of the eyes, between its life support and its terminal, as
    // the Miner's)
    dash: { arc: 2.84958, at: [0.3588, 3.328, 6.2753], w: 0.695, h: 0.2151, lean: 0.385, tall: { at: [0.4262, 3.3207, 6.5596], w: 0.5541, h: 0.1715, lean: 0.31 },
      rider: { at: [-0.6227, 3.3248, 6.3653], w: 0.6713, h: 0.2078, lean: 0.385, tall: { at: [-0.5363, 3.3182, 6.6423], w: 0.5357, h: 0.1658, lean: 0.31 } } },
    floor: null, shove: { mass: 2, gyr: 4 }, voice: 'medic',
  },
];
export const SHIP_IDS = SHIPS.map((s) => s.id);
export const shipOf = (id) => SHIPS.find((s) => s.id === id) || null;

// ── the points a ship bumps by: each box's corners and edges, top and bottom ──
// (along each box: its ends, its middle and half way to each; the middle of a box that reaches across the ship's own
// middle is the ship's middle: so the Miner's one box gives exactly the points it always had)
export function boxPoints({ a: [a0, a1], r, h }) {
  const mid = a0 < 0 && a1 > 0 ? 0 : (a0 + a1) / 2, along = [a0, (a0 + mid) / 2, mid, (mid + a1) / 2, a1], out = [];
  for (const u of [0, h]) for (const s of [-r, r]) for (const a of along) out.push([a, u, s]);
  out.push([a1, h / 2, 0], [a0, h / 2, 0], [mid, 0, 0], [mid, h, 0]);
  return out;
}
export const pointsOf = (boxes) => boxes.flatMap(boxPoints);

// a ship's parked turn as a quaternion [x, y, z, w]: none for nose out (the flight model's own way round); half way
// round about straight up for nose in
const PARKED_IN = [0, 1, 0, 0];

// ── WHAT THE FLIGHT MODEL FLIES (src/flymodel.js makeShip(cfg)), and the ships it meets parked in the other hangars ──
// (made once each: the flight model keeps a few sums on the cfg itself)
const made = new Map(), others = new Map();
export function flightOf(id) {
  if (made.has(id)) return made.get(id);
  const s = shipOf(id); if (!s) return null;
  const H = HANGARS[s.hangar], cfg = {
    id: s.id, room: 'ship-' + s.id, hangar: H.id,
    pad: padOf(s.hangar),
    points: pointsOf(s.boxes),
    hover: s.hover, low: s.low, seat: s.seat, behind: s.behind, dash: s.dash,
    bay: bayOf(H.z, { top: CEILING[H.id] }),
    floor: s.floor,
    others: null,
    voice: s.voice,
    ...(s.claw ? { claw: s.claw } : {}),
    name: s.name, model: s.model,
    ...(s.nose < 0 ? { q0: PARKED_IN } : {}),
  };
  made.set(id, cfg);
  cfg.others = othersOf(id);
  return cfg;
}
// THE OTHER SHIPS, AS ONE FLOWN SHIP MEETS THEM PARKED IN THEIR HANGARS (src/flymodel.js makeOther, pushOthers,
// visiting): each its hangar and its bay (as wide as its door; its ceiling at 8.4 m, as the Miner has always felt the
// other two), where it is parked and which way its nose points there, its shape, and how heavy it is (mass: Infinity
// for one that is not moved by a bump). keep: what a shoved one is kept inside, every corner of it ({ x0, x1, z0, z1 };
// none: its bay, in from the door's line): a ship with a floor of its own (the Miner) slides only about that floor,
// where its crane can get at every canister of it and its trays have room to slide out (src/flymodel.js MINER.floor
// has why: the rack, the cart, the rails' ends)
export function othersOf(id) {
  if (others.has(id)) return others.get(id);
  const L = SHIPS.filter((s) => s.id !== id).map((s) => {
    const H = HANGARS[s.hangar];
    return { id: s.id, name: s.name, room: 'ship-' + s.id, hangar: H.id, at: padOf(s.hangar), nose: s.nose, boxes: s.boxes, bay: bayOf(H.z), mass: s.shove ? s.shove.mass : Infinity, gyr: s.shove ? s.shove.gyr : 4,
      ...(s.floor ? { keep: { x0: s.floor.x[0], x1: s.floor.x[1], z0: s.floor.z[0], z1: s.floor.z[1] } } : {}) };
  });
  others.set(id, L);
  return L;
}
