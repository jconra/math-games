// THE LIFT AND THE TWO PLACES IT GOES TO, AS PLAIN NUMBERS (no three.js: the tests read them, and the kit's pieces
// and the game's lift are drawn and run from these same numbers). Metres, the station's own frame: x east, y up from
// the main deck's floor, z south.
//
// THE GAME'S MAKER, in his own words (this is the brief; nothing here goes beyond it):
//   2026-11-19  "Another thing that I think we need in the station is a control room. I wonder if we could build out
//               the top of the control tower and have an elevator that takes us up there. I was thinking the elevator
//               could also take us down to the shipping area and there could be games in both places. I figure the
//               elevator at least makes culling easy because it's a great opportunity to remove the old scene and
//               load a new scene."
//               "I feel like the elevator doesn't have to be completely believable. We can just have a box along the
//               hallway somewhere that opens and then you get teleported to the same looking box at the control room
//               or cargo area."
//               "It makes sense for the lift to be in the center, since you'd think it had to have come up the
//               center. We probably need some models for pallets. Maybe a forklift.. hah." (he makes the forklift
//               himself: its place on the floor is left empty)
//               "I think the storage room needs to be much bigger than your design, especially if there is going to
//               be a forklift driving around. It can go out underneath the arena and even under the hangers if needed
//               right? I would imagine that a space station should have a good supply"
//               Of the store's drawing: the scale moved up, out of the way of the containers; "there should be some
//               doors that appear to go into cold storage also, although we don't have to build that"; "I would stop
//               the aisles sooner" (a lane up the east wall). Then "That looks good to me".
//               Of the small jets on the roof's pads: "They could just fly by once in a while out the window if you
//               were in the control tower."
// The agreed drawings: ~/pw/space-math/shots/control-room-1/plan_1 (the lift box at A), plan_2 (layout 1: the lift
// in the middle, a desk at each side), plan_3 (the store, as drawn).

// ── THE LIFT ────────────────────────────────────────────────────────────────────────────────────────────────────
// ONE BOX, the same at every stop: a station cell (2 m by 2 m, 3 m tall) with its walls inside it, so 1.56 m clear
// inside, its doorway on its east side. Nothing joins the boxes: walked into, its doors shut behind the player, the
// player is taken to the same spot in the box at the stop picked, and its doors open there.
//   stops, top to bottom as on a lift's panel: id, the words on its button, a few words under them, the station
//   file's room it stands in, the middle of its floor, its quarter turns (1: its doorway faces east)
export const LIFT = { half: 1, clear: 0.78, wall: 0.22, h: 3, step: 0.03, doorHalf: 0.55 };
export const STOPS = [
  { id: 'tower', name: 'Control room', sub: 'Top of the tower', room: 'tower', at: [40, 44.7, 25], turn: 1 },
  { id: 'deck', name: 'Main deck', sub: 'By the junction', room: 'lift', at: [12, 0, 28], turn: 1 },
  { id: 'store', name: 'Store room', sub: 'The lower level', room: 'store', at: [12, -4.75, 28], turn: 1 },
];

// ── THE CONTROL ROOM, in the tower's control centre (kit/outside-plan.js: the spire's band with the big windows, its
// wall 44.6 to 48 m up and 16.8 m across outside, its corners cut). Layout 1 of plan_2: the lift in the middle, a desk at
// each side. The room stands just inside the band: eight walls (four long ones, four across the cut corners), big
// windows all round, low enough to see the station's roof below (a control tower's view), a cove from the walls' top
// up to a flat ceiling under the band's roof.
//   half: the middle to a long wall's face; leg: how far each corner is cut back along a wall (both inside faces)
export const TOWER = { x: 40, z: 25, floor: 44.7, half: 7.95, leg: 3.93, thick: 0.25, top: 47.9, ceiling: 48.9, sill: 0.25, head: 2.85, mullion: 0.3 };
// the eight corners of the room's inside face, going round (north is -z): [x, z] from the room's middle
export function towerCorners(half = TOWER.half, leg = TOWER.leg) {
  const h = half, k = half - leg;
  return [[k, -h], [h, -k], [h, k], [k, h], [-k, h], [-h, k], [-h, -k], [-k, -h]];
}
// THE DESKS (plan_2, layout 1): each a long console with its back to the windows and its chairs on the room's side.
//   kind, the middle of its foot [x, z] from the room's middle, its quarter turns (its front, where people sit, faces
//   +z at turn 0), its length, and what it looks out over
export const DESKS = [
  { kind: 'radio', at: [-6.25, 0], turn: 1, long: 6.4, over: 'the dock and the landing pads' },
  { kind: 'traffic', at: [6.25, 0], turn: 3, long: 6.4, over: 'the hangar doors: ships come and go' },
  { kind: 'announce', at: [0, -6.2], turn: 0, long: 6.4, over: 'the station\'s north end' },
  { kind: 'readouts', at: [0, 6.2], turn: 2, long: 6.4, over: 'the station\'s south end' },
];
export const DESK = { deep: 1.0, h: 0.78, chairOut: 1.05 };

// ── THE STORE, the whole lower level (kit/outside-plan.js DECK_PATH: the deck under the west rooms, from the cargo
// slots' face east to under the hangars' back edge). Its floor is the cargo slots' own foot, so a container's end
// stands on it. Its walls stand on the station's grid lines inside the deck's hull: the north wall, the east wall
// under the hangars, the south wall under the terminal's; the west wall 0.4 m in from the slots' face (the walls
// between the slots outside, kit/outside-plan.js dockPlans, bring their plates in that far); and across the cut corner
// one slanting wall, half a metre inside the hull's own slant.
export const STORE = { floor: -4.75, h: 3.75, x0: -6.6, x1: 25, z0: -9, z1: 37,
  // the slanting wall's line (the side away from the room) from its north end to its west end
  cut: [[8.84, -9], [-6.6, -3.114]] };
// the four cargo slots in the west wall (kit/outside-plan.js SLOTS): their middles along z, the opening's size; the
// first three hold a container whose inner end comes in to x = END (the outside's own containers: SLOTS.x - 0.45 +
// DOCK.in), the fourth is empty and has a shield across it, as a hangar door has
export const SLOT = { z: [3.5, 8, 12.5, 17], w: 2.9, h: 2.9, full: [0, 1, 2], end: -3.383, box: [2.44, 2.6], colours: ['#2f62b8', '#a8392f', '#2c8a57'] };
// THE RACKS (plan_3): six rows along x, each 1.3 m deep, 3.7 m aisles between them; they stop short of the east wall
// so a lane runs up it. A row is so many bays; a bay holds two pallets on the floor and two on each of two shelves.
//   z: each row's middle; x0: where it starts (the first row starts further east: the cut corner and the scale are
//   west of it); x1: where every row ends
export const RACKS = { z: [-5.55, -0.55, 4.45, 9.45, 14.45, 19.45], x0: [10.6, 6.2, 6.2, 6.2, 6.2, 6.2], x1: 19.8, deep: 1.3, bay: 2.72, levels: [0, 1.25, 2.45], beam: 0.12, top: 3.3 };
export const baysOf = (row) => Math.floor((RACKS.x1 - RACKS.x0[row]) / RACKS.bay + 1e-6);
// THE REST OF THE FLOOR (plan_3), each [x0, x1, z0, z1]: the scale north of container 01 by the cut corner, out of the
// containers' way; the packing benches and the shipping desk at the south end; the forklift's place (left empty: a
// painted bay); the pallets waiting on the loading floor; the two cold store doors in the east wall at the ends of two
// aisles (doors only: nothing is behind them)
export const FLOOR = {
  scale: [-1.2, 2.2, -3.4, 0],
  benches: [-4.8, 2.6, 25.6, 27.8],
  desk: [-4.8, 2.6, 29.6, 31.8],
  forklift: [4.6, 9.2, 31.4, 34.4],
  waiting: [[-0.2, 15.5], [1.5, 15.5], [3.2, 15.5], [1.5, 19.6]],
  cold: [{ z: 2, n: 1 }, { z: 12, n: 2 }],
};
// where nobody walks in the store, for the tests: every rack, the benches, the desk, the scale's post, the pallets
// waiting, the container ends ([x0, x1, z0, z1])
export function storeBlocks() {
  const out = [];
  RACKS.z.forEach((z, i) => out.push({ what: 'rack ' + (i + 1), box: [RACKS.x0[i], RACKS.x0[i] + baysOf(i) * RACKS.bay, z - RACKS.deep / 2, z + RACKS.deep / 2] }));
  out.push({ what: 'the packing benches', box: FLOOR.benches.slice() }, { what: 'the shipping desk', box: FLOOR.desk.slice() });
  for (const [x, z] of FLOOR.waiting) out.push({ what: 'a pallet waiting', box: [x - 0.6, x + 0.6, z - 0.5, z + 0.5] });
  SLOT.full.forEach((k) => out.push({ what: 'container 0' + (k + 1), box: [STORE.x0, SLOT.end, SLOT.z[k] - SLOT.box[0] / 2, SLOT.z[k] + SLOT.box[0] / 2] }));
  return out;
}
