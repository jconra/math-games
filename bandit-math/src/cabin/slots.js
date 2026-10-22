// THE CABIN'S FURNISHINGS: the fixed spots in the player's cabin where a piece can go, what each costs, and which ones a
// rider owns. Plain data and small helpers only (no three.js), so the tests can read it without a browser.
//
// Every piece stands in one fixed SLOT. A slot names its model file (models/furniture/<file>.glb) or says it is made in
// code (pieces.js), where it stands in the cabin (metres, in cabin_inside.glb's own space: the floor is about 0.8 m up,
// the door is on the +z side, the room runs x -2.4 .. 3.0 and z -2.85 .. 0.6), and how big it should be. A file is fitted
// to its slot whatever size it comes at (its longest side across the floor is made `fit` metres, or its height `fitH`),
// stood on the floor, centred, and turned so its own front (+z) faces the way `rot` says. So a nicer model (a Tripo one)
// replaces a stand-in by changing `file` and nothing else.
//
// The prices make a ladder from a cheap rug to a costly stove, so there is always a next thing to save for. The prices
// are in src/catalog.js (PRICES.furniture), with every other price, to be tuned in one place after watching a few rides.
//
//   SLOTS                 the slots, cheapest first: { id, name, line, price, file | made, at, rot, fit, fitH, box, looks }
//                         at: [x, y, z] (y null: on the floor); rot: degrees about y (0: the piece's front faces +z, the
//                         door); box: [w, d] the floor it takes (you walk round it), null for a rug or a wall piece;
//                         looks: the points you look at to pick it (as E picks); also: a piece made in code that goes
//                         with the file (the stove's fire and pipe)
//   ownedPieces(rider)    -> the slot ids this rider owns (from rider.owned.cabin; anything unknown dropped)
//   nextPiece(rider)      -> the cheapest slot not owned yet, or null when the cabin is full
//   homeDogs(rider)       -> the rider's dogs as { kind, name, following }: the one following you and the ones at home
//   buyPiece(rider, id, spend)  -> 'bought' | 'owned' | 'short' | 'unknown'   (spend: save.js spend; saves on a buy)

import { PRICES } from '../catalog.js';

export const SLOTS = [
  { id: 'rug', name: 'Rag rug', price: PRICES.furniture.rug, made: 'rug', line: 'A braided rag rug for the middle of the floor. Warm on the feet.',
    at: [0.35, null, -1.2], rot: 0, size: [2.1, 1.4], box: null, looks: [[0.35, 0.82, -1.2]] },
  { id: 'lanterns', name: 'Two lanterns', price: PRICES.furniture.lanterns, made: 'lanterns', file: 'lantern', line: 'Two oil lanterns hung from the beams. The room glows at night.',
    at: [0, 0, 0], rot: 0, box: null, looks: [[-0.69, 2.84, -1.75], [1.44, 2.84, -1.0]] },
  { id: 'picture', name: 'A painting', price: PRICES.furniture.picture, file: 'picture', line: 'A painting of a farm by a river, in a gilt frame, over the bed.',
    at: [-1.35, 2.35, -2.9], wall: [0, 0, -1], rot: 0, fit: 0.75, box: null, looks: [[-1.35, 2.35, -2.75]] },
  { id: 'dogbeds', name: 'Dog beds', price: PRICES.furniture.dogbeds, made: 'dogbeds', line: 'A soft bed for every dog you own. Dogs at home sleep inside on them.',
    at: [-1.9, null, -0.3], rot: 0, box: null, looks: [[-1.9, 0.9, -0.3], [-1.9, 0.9, -1.25], [-0.98, 0.9, -0.42]] },   // (a bed is 0.86 m across: the spots stay over 0.9 m apart)
  { id: 'table', name: 'Table and chairs', price: PRICES.furniture.table, file: 'table', line: 'A plain pine table and two chairs. Open your lock boxes here.',
    at: [2.3, null, -0.95], rot: 90, fit: 1.13, box: [0.8, 1.2], looks: [[2.3, 1.6, -0.95]],
    extra: [{ file: 'chair', at: [1.62, null, -0.62], rot: 90, fitH: 0.96, box: [0.5, 0.5] }, { file: 'chair', at: [1.62, null, -1.3], rot: 75, fitH: 0.96, box: [0.5, 0.5] }] },
  { id: 'porch', name: 'Porch rockers', price: PRICES.furniture.porch, file: 'porch_chair', line: 'Two rocking chairs out on the porch, to watch the sun go down.',
    at: [-0.95, null, 1.75], rot: 8, fit: 0.83, box: null, looks: [[-0.95, 1.3, 1.75], [1.32, 1.3, 1.45]],
    extra: [{ file: 'porch_chair', at: [1.32, null, 1.45], rot: -8, fit: 0.83, box: null }] },
  // (the porch: the steps and the door on x -0.4 .. 1.0; the model's own barrel and crate stand at its left back corner
  // (x -1.85 .. -1.0, z up to 1.6) and its own rocker and log pile on the right (x 1.75 .. 3.0): the two bought rockers
  // stand in the clear floor between, on either side of the way in, facing out to the yard (the chair's front is +z))
  { id: 'bed', name: 'Quilted bed', price: PRICES.furniture.bed, file: 'bed', line: 'A log bed with a patchwork quilt, under the painting.',
    at: [-1.38, null, -2.25], rot: 90, fit: 1.9, box: [1.06, 1.9], looks: [[-1.35, 1.3, -2.25]] },   // (head to the left wall)
  { id: 'rifles', name: 'Rifle rack', price: PRICES.furniture.rifles, made: 'rifles', line: 'A rack on the wall with two rifles, like any ranch house.',
    at: [-2.4, 2.0, -0.45], wall: [-1, 0, 0], rot: 90, box: null, looks: [[-2.25, 2.0, -0.45]] },
  { id: 'stove', name: 'Iron stove', price: PRICES.furniture.stove, file: 'stove', also: 'stovefire', fitH: 1.05, line: 'A cast-iron wood stove with a fire in it. The heart of a home.',
    at: [2.45, null, -2.3], rot: -45, box: [0.85, 0.85], looks: [[2.45, 1.4, -2.3]] },
];
export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

// the slot ids a rider owns (rider.owned.cabin: a list of slot ids; an old save has none)
export function ownedPieces(rider) {
  const list = rider && rider.owned && Array.isArray(rider.owned.cabin) ? rider.owned.cabin : [];
  return SLOTS.filter((s) => list.includes(s.id)).map((s) => s.id);
}

export function nextPiece(rider) {
  const have = ownedPieces(rider);
  return SLOTS.filter((s) => !have.includes(s.id)).sort((a, b) => a.price - b.price)[0] || null;
}

// Buys a piece: spend(rider, price) takes the gold and saves (save.js spend); the piece is added to rider.owned.cabin
// (in the slot table's order) and saved again with it.
export function buyPiece(rider, id, spend, save = () => {}) {
  const s = SLOT[id]; if (!s) return 'unknown';
  if (ownedPieces(rider).includes(id)) return 'owned';
  if (!spend(rider, s.price)) return 'short';
  const o = rider.owned || (rider.owned = {});
  o.cabin = ownedPieces(rider).concat(id);
  o.cabin = SLOTS.filter((x) => o.cabin.includes(x.id)).map((x) => x.id);
  save(rider);
  return 'bought';
}

// The rider's dogs (the same reading as the general store's: owned.dogs, one of each breed, plus owned.dog, the one
// that follows you; a save from before the list has only owned.dog). following: true for the one out with you.
const BREEDS = ['shiba', 'husky', 'pug'];
export function homeDogs(rider) {
  const o = (rider && rider.owned) || {};
  const list = Array.isArray(o.dogs) ? o.dogs.filter((d) => d && typeof d === 'object' && BREEDS.includes(d.kind) && d.name) : [];
  const out = list.map((d) => ({ kind: d.kind, name: String(d.name) }));
  if (o.dog && BREEDS.includes(o.dog.kind) && !out.some((d) => d.kind === o.dog.kind)) out.unshift({ kind: o.dog.kind, name: String(o.dog.name || 'Dog') });
  const seen = new Set();
  return out.filter((d) => (seen.has(d.kind) ? false : seen.add(d.kind))).map((d) => {
    const following = !!(o.dog && o.dog.kind === d.kind);
    return { kind: d.kind, name: following && o.dog.name ? String(o.dog.name) : d.name, following };
  });
}

// Where the belt-buckle keepsakes go (save.js KEEPSAKES says what each one is and which buckle brings it): a spot in
// the cabin for each job's keepsake. A farm job's later animals (a coop, a pen, a little corral) belong outside the
// cabin, beside the porch: see FARM_SPOTS.
export const KEEPSAKE_SPOTS = {
  cattle: { at: [1.6, 2.5, -2.85], wall: [0, 0, -1] },       // the steer horns, on the back wall over the safe door, clear of
                                                              // the beams (over the door a ceiling beam ran through them)
  boxes: { at: [1.75, null, -2.62], rot: -10 },               // the cracked safe door, leaning on the back wall by the stove
  sheep: { at: [1.12, 2.35, 0.62], wall: [0, 0, 1] },         // the sheep bell, hanging by the door
  pigs: { at: [2.95, 1.95, -1.9], wall: [1, 0, 0] },          // the carved pig, on a little shelf on the right-hand wall
  bandits: { at: [-2.4, 2.45, -1.75], wall: [-1, 0, 0] },     // the wanted posters, on the left-hand wall over the bed's foot
  deliveries: { at: [-1.55, 3.0, 0.62], wall: [0, 0, 1] },    // the freight company's sign, high on the front wall
  orders: { at: [2.3, null, -0.62], table: 0.8, rot: -60 },  // the store's brass counter bell, on the table (on a crate till there is one)
  loot: { at: [0.55, null, -2.5], rot: 0 },                  // the gang's strongbox, on the floor against the back wall (between the bed's foot and the safe door)
  targets: { at: [2.95, 1.6, -1.22], wall: [1, 0, 0] },        // the shot-up tin cans from the target range, on a little shelf on the right-hand wall over the table
  tower: { at: [2.95, 1.6, -0.45], wall: [1, 0, 0] },          // the little carved windmill, on the sill of the right-hand wall's window over the table (its shelf is the sill), looking out
  loads: { at: [2.95, 1.6, 0.25], wall: [1, 0, 0] },          // the little model truss bridge, on its own shelf on the right-hand wall, by the front corner (past the windmill)
  fish: { at: [-0.62, 1.95, -2.85], wall: [0, 0, -1] },       // the mounted fish on its plaque, on the back wall between the painting over the bed and the window
};
// Not built yet (the farm jobs' later work): where a rider's own farm animals would live, in the town cabin's own space
// (metres from its middle, its front +z): a chicken coop on its left side, a pig pen and a little corral behind it.
export const FARM_SPOTS = {
  coop: { side: -1, along: 0.2, out: 3.5 },
  pen: { back: 1, along: -0.3, out: 4 },
  corral: { back: 1, along: 0.4, out: 6 },
};
