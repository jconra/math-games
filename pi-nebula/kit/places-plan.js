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
//               center. We probably need some models for pallets. Maybe a forklift.. hah." (he made the forklift
//               himself: it parks in its painted place on the floor, FORKLIFT below)
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
// (the lower level is called CARGO wherever a player sees its name, 2026-11-20, the game's maker: "Lets just call it
// "Cargo". If you call it store then people will think you can buy stuff there." Its code name stays 'store'.)
export const LIFT = { half: 1, clear: 0.78, wall: 0.22, h: 3, step: 0.03, doorHalf: 0.55 };
export const STOPS = [
  { id: 'tower', name: 'Control room', sub: 'Top of the tower', room: 'tower', at: [40, 44.7, 25], turn: 1 },
  { id: 'deck', name: 'Main deck', sub: 'By the junction', room: 'lift', at: [12, 0, 28], turn: 1 },
  { id: 'store', name: 'Cargo', sub: 'The lower level', room: 'store', at: [12, -4.75, 28], turn: 1 },
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
// containers' way; the packing benches and the shipping desk at the south end; the forklift's place (a painted bay:
// his forklift parks in it, FORKLIFT below); the pallets waiting on the loading floor (their middles [x, z]: the
// forklift's own, which it carries to the shelves, CARGO below); the two cold store doors in the east wall at the ends
// of two aisles (doors only: nothing is behind them)
export const FLOOR = {
  scale: [-1.2, 2.2, -3.4, 0],
  benches: [-4.8, 2.6, 25.6, 27.8],
  desk: [-4.8, 2.6, 29.6, 31.8],
  forklift: [4.6, 9.2, 31.4, 34.4],
  waiting: [[-0.65, 15.6], [0.8, 15.6], [2.25, 15.6], [3.7, 15.6]],
  cold: [{ z: 2, n: 1 }, { z: 12, n: 2 }],
};
// A PALLET (kit/store.js pallet: a low platform, its load on it): 1.2 m long (its skids run along it) and 1 m across;
// its deck's underside is `deck` over the floor (the forks go in under it, between the skids); its load stands up to
// `top` (the tallest load, the wrapped one's)
export const PALLET = { long: 1.2, wide: 1, deck: 0.1, top: 1.04 };
// THE FORKLIFT'S ROUND (2026-11-20, the game's maker, of what his forklift does, question FORK1-1, C: "Now and then one
// of Cargo's people drives it to carry a pallet: from the loading floor by the containers to the shelves, then parks
// it again."). Its own pallets, drawn apart from the room so they can be carried (kit/cargopallets.js), each turned so
// its skids run north to south: the forks go in along them.
//   waiting  FLOOR.waiting: pallets waiting on the loading floor, a row south of container 03; the forklift comes up to
//            each from the south
//   shelf    where it sets them: the floor level of the last row of racks (row 6), from its south side, the open floor
//            between the racks and the benches. (Not the aisles: they are 3.7 m wide and it is 3.7 m long with a pallet
//            on its forks, so it cannot turn in one.) [x, z]: a pallet's middle there, 0.75 m in from a post (so the
//            forklift's front wheels pass the posts by 10 cm), its front edge 5 cm proud of the rack's face (so its
//            body stops short of the face)
//   up       THE FIRST SHELF (2026-11-20, the game's maker, question FORK2-1, B: "It lifts them onto the first shelf,
//            the forks' frame rising past the top of the mast as in the right picture", and "It looks good to me. I
//            don't see it going up past the top of the mast"): over the two places on the floor level whose first shelf
//            is free (the room's own pallets stand on it over the other two), the same [x, z]; a pallet there stands
//            on the shelf's deck, upY over the floor (the first beam's top: 1.37 m). It sets a pallet on the first
//            shelf while it has room, on the floor level when it has none (src/cargoforklift.js)
//   pallets  each pallet's load and where it is at the start: 'w<n>' a waiting place, 's<n>' a place on the racks'
//            floor level, 'u<n>' a place on the first shelf
// (A pallet carried to the shelves comes back to the loading floor now and then, as one arriving: src/cargoforklift.js.)
export const CARGO = {
  waiting: FLOOR.waiting,
  shelf: [[13.61, 19.55], [15.11, 19.55], [16.33, 19.55], [17.83, 19.55]],
  up: [[16.33, 19.55], [17.83, 19.55]], upY: RACKS.levels[1] + RACKS.beam,
  pallets: [{ load: 'wrapped', at: 'w0' }, { load: 'crates', at: 'w1' }, { load: 'boxes', at: 'w2' }, { load: 'totes', at: 'w3' }, { load: 'boxes', at: 's0' }, { load: 'boxes', at: 's1' }, { load: 'drums2', at: 's3' }],
};
// (a pallet of the forklift's, as it stands at a place: [x0, x1, z0, z1], its skids along z)
export const palletBox = ([x, z]) => [x - PALLET.wide / 2, x + PALLET.wide / 2, z - PALLET.long / 2, z + PALLET.long / 2];
// THE FORKLIFT (2026-11-20, the game's maker: "I like making models anyway. I'll get a forklift"): his own model, made
// in Tripo (assets/cargo/forklift.glb: his file with its picture made smaller, his shape untouched; kit/forklift.js
// draws it), parked in its painted place. In his file it is one unit long, its forks along +x, its foot on y = 0:
//   raw    its size in his file [long, tall, wide] (his units; the tallest part is the mast)
//   mast   how tall its mast stands (m): it is fitted by its mast, so a real small forklift's 2 to 2.2 m. So its body is
//          2.5 m long to the forks' face (3.45 m with its forks) and 1.14 m wide across its wheels, as a real one is.
//          (Fitted by its length instead, 3 m with its forks, its mast would be 1.83 m, lower than a person's head.)
//   at     the middle of its foot [x, z] (the middle of the painted place: FORKLIFT on the floor shows past its north
//          side, the stripes past its south side); yaw: its turn about straight up (0: its forks to the east, toward
//          the open floor south of the lift, where it would drive out)
//   forks  where its two forks lie in his file [x0, x1, z0, z1] (his units). They lie low on the floor, under the
//          heights a person's body is felt at (src/walls.js BODY), so a block over them, knee high, stands in the
//          walls with the forklift: nobody walks over its forks
// Its moving parts, read off his file (his units; his mesh's own pieces, each apart from the rest where his triangles
// part: ~/pw/space-math/shots/forklift-2/pieces/), none of them cut or changed (kit/forklift.js):
//   face      where the forks leave the carriage (its frame's front), along x
//   carriage  every piece wholly in front of this x is the carriage: its frame and its two forks, which go up and down
//             together in front of the mast (the mast itself is one piece and stays)
//   axles     [x, y, the wheels' radius]: the front pair, then the back pair (a forklift steers by its back wheels)
//   wheelZ    the wheels' middles out from its middle line
//   seat      the middle of its seat's cushion, on top [x, y]
//   blade     the top of the forks' blades (at their heel; they lie from 0.017 up)
//   nose      how far forward the rest of it reaches, its carriage left out (its body, the foot of its mast and the
//             top of it), along x: with the carriage up, nothing of it in front of this lower down
//             (~/pw/space-math/rigs/forklift-3/front.py)
export const FORKLIFT = { raw: [0.9995, 0.6079, 0.3296], mast: 2.1, at: [6.9, 32.9], yaw: 0, forks: [0.22, 0.5, -0.096, 0.095],
  face: 0.233, carriage: 0.185, axles: [[0.111, 0.086, 0.084], [-0.394, 0.075, 0.075]], wheelZ: 0.131, seat: [-0.195, 0.315], blade: 0.03, nose: 0.2087 };
export const forkliftScale = () => FORKLIFT.mast / FORKLIFT.raw[1];
// its foot on the floor at its place, [x0, x1, z0, z1] (m, the station's frame; a quarter turn at most)
export function forkliftBox() {
  const k = forkliftScale(), along = Math.abs(Math.cos(FORKLIFT.yaw)) > 0.5, L = FORKLIFT.raw[0] * k / 2, W = FORKLIFT.raw[2] * k / 2;
  const [hx, hz] = along ? [L, W] : [W, L], [x, z] = FORKLIFT.at;
  return [x - hx, x + hx, z - hz, z + hz];
}

// where nobody walks in the store, for the tests: every rack, the benches, the desk, the scale's post, the pallets
// waiting, the container ends ([x0, x1, z0, z1])
export function storeBlocks() {
  const out = [];
  RACKS.z.forEach((z, i) => out.push({ what: 'rack ' + (i + 1), box: [RACKS.x0[i], RACKS.x0[i] + baysOf(i) * RACKS.bay, z - RACKS.deep / 2, z + RACKS.deep / 2] }));
  out.push({ what: 'the packing benches', box: FLOOR.benches.slice() }, { what: 'the shipping desk', box: FLOOR.desk.slice() });
  for (const p of FLOOR.waiting) out.push({ what: 'a pallet waiting', box: palletBox(p) });
  SLOT.full.forEach((k) => out.push({ what: 'container 0' + (k + 1), box: [STORE.x0, SLOT.end, SLOT.z[k] - SLOT.box[0] / 2, SLOT.z[k] + SLOT.box[0] / 2] }));
  return out;
}
