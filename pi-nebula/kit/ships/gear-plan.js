// THE LANDING GEAR'S PLAN, every ship's (no three.js here: the kits draw it, the tests read it, the hull rigs use it).
// The game's maker, 2026-11-26, of the Explorer parked on the hangar floor: "these landing gear coverings.. are kind of
// hideous. The ship would look a lot better if none of this was here and you could just see the landing gear. We should
// just have doors that slide in place. Its fine if the landing gear is kind of magic and folds into itself"; and of the
// Miner: "I don't see front landing gear on the miner ship". So, on the Explorer and the Miner:
//   - each leg is a slim TELESCOPE standing in a well in the hull: nested tubes over a broad foot. Going up (door
//     'gear', 0 down to 1 up) the tubes slide up into one another and the foot rises to just inside the hull, so the
//     whole leg folds into itself in the well; the well's top tube never moves (it stays in the well)
//   - each well is closed by two DOORS cut from the hull's own skin (fore and aft halves), flush in it when shut; they
//     slide apart, along the ship and a little into the hull (so they pass behind the skin round the well), to open
//     (door 'doors', 0 open to 1 shut). Up: the legs first, then the doors; down: the doors first, then the legs
//     (gearOrder)
//   - every ship stands on legs fore and aft (FEET: where each ship's feet are, nose +z)
// The Medic and the Hauler keep their own legs (the Medic's are its smart mesh's, from his picture; the Hauler's his
// sheets'): each already rises into a well whose mouth its foot closes; they are in FEET for the rule fore and aft.

// ── THE TELESCOPE ─────────────────────────────────────────────────────────────────────────────────────────────────────
// LEG: the foot's height (its pad and the hub over it), how far over the shut door's skin the foot stows (the door's
// thickness and a little air), how much each tube overlaps the next when the leg is down
export const LEG = { foot: 0.15, pad: 0.06, clear: 0.07, overlap: 0.07 }, TUBE_STEP = 0.02;
// A leg's tubes, from where it stands: top (where its top tube's top is, in the well), belly (the skin's highest point
// over the well's mouth), floor (the ground, in the same frame). The top tube spans from just over the stowed foot to
// the top and never moves; there are as few tubes as reach the floor, each the top tube's length, and tube k slides up
// k steps going up; the foot slides up (n - 1) steps, to `clear` over the belly. Returns { n, len, step, tubes: [{ y0,
// y1, rise }] (down, top first), foot: { y0, y1, rise } }
export function telescope({ top, belly, floor }, L = LEG) {
  const len = top - (belly + L.clear + L.foot), reach = top - (floor + L.foot);
  if (len < 0.2) throw new Error(`landing leg: its well is too shallow (${len.toFixed(2)} m of tube)`);
  const n = Math.max(2, Math.ceil((reach - len) / (len - L.overlap) - 1e-9) + 1), step = (reach - len) / (n - 1);
  const tubes = [];
  for (let k = 0; k < n; k++) tubes.push({ y0: top - k * step - len, y1: top - k * step, rise: k * step });
  return { n, len, step, tubes, foot: { y0: floor, y1: floor + L.foot, rise: (n - 1) * step } };
}

// ── THE SLIDING DOORS ─────────────────────────────────────────────────────────────────────────────────────────────────
// How far a well's door half moves to open: along the line the well is split across (axis 2, along the ship: fore and
// aft halves; or 0, across it: port and starboard halves, where the skin fore and aft of the well is not flat), away
// from the well's middle by half the well's size that way and a little more, and `sink` into the hull along its skin's
// inward normal (square to that line). A half: { axis, dir (-1 or +1 along that axis), len (the well's size along it),
// n (the half's skin's outward normal, averaged; [x, y, z]), sink (how far into the hull: DOOR.sink if not given), up
// (sink straight up instead), one (if given, -1 or +1: both halves slide that way together, the well's whole size, as
// one door: where the skin on one side of the well ends too soon) }.
export const DOOR = { sink: 0.09, past: 0.05 };
export function doorSlide({ axis = 2, dir, len, n, sink = DOOR.sink, one = 0, up = false }) {
  // (the sink is across the line it slides along, so however the skin leans it slides its whole way along that line;
  // or, `up`, straight up, where the skin round the well leans every way)
  const m = up ? [0, -1, 0] : n.map((v, k) => (k === axis ? 0 : v)), l = Math.hypot(...m) || 1, S = m.map((v) => -sink * v / l);
  S[axis] += one ? one * (len + DOOR.past) : dir * (len / 2 + DOOR.past);
  return S;
}

// ── IN TURN ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Up: the legs fold first, then the wells' doors shut; down: the doors open first, then the legs come down. legs, doors:
// the kit's doors (each with t: legs 0 down .. 1 up; doors 0 open .. 1 shut); move(list, mode): moves those a step
// toward 'open' (t 1) or 'shut' (t 0) and says whether any moved. Returns whether anything moved.
export function gearOrder(legs, doors, up, move) {
  if (up) { const m = move(legs, 'open'); return legs.every((D) => D.t >= 1) ? move(doors, 'open') || m : m; }
  const m = move(doors, 'shut'); return doors.every((D) => D.t <= 0) ? move(legs, 'shut') || m : m;
}

// ── WHERE THE LEGS ARE ────────────────────────────────────────────────────────────────────────────────────────────────
// Each telescoping leg: at [x, z] (the ship's frame: port +x, nose +z; the foot's middle), top (its well's top, the top
// tube's top), belly (the skin's highest point over its well's mouth: the hull rigs measure it), r (the top tube's
// radius; each tube inside it 2 cm less: TUBE_STEP), pad [across, along] (the foot's size). floor: the ground in the ship's frame
// (the Miner stands STAND higher on its legs than its hull's own ground line), well [half across, half along] (its
// mouth, round the foot), split (the axis its doors part along: 2 fore and aft, the default; 0 port and starboard),
// sink (how far its doors go into the hull as they open, where the skin round the well is not flat; DOOR.sink if not),
// one, up (how its doors slide: doorSlide).
// The wells are cut in the hull data
// (WELLS, DOORS) by the rigs in ~/pw/space-math/rigs/gear-2/.
const mirror = (L) => Object.fromEntries(Object.entries(L).flatMap(([k, v]) => (k.includes('port') ? [[k, v], [k.replace('port', 'starboard'), { ...v, at: [-v.at[0], v.at[1]], ...(v.one && v.split === 0 ? { one: -v.one } : {}) }]] : [[k, v]])));
export const LEGS = {
  // the Explorer: the nose leg under the cockpit (its well's top under the cockpit's floor); the aft two under the
  // hull's sides, 2.31 m out (as its old legs), their wells going up beside the cabin's side walls
  explorer: { floor: 0, legs: mirror({
    nose: { at: [0, 5.95], top: 1.99, belly: 1.08, r: 0.17, pad: [0.5, 0.56], well: [0.3, 0.32], split: 0 },
    port: { at: [2.31, -3.72], top: 3.9, belly: 2.27, r: 0.2, pad: [0.44, 0.62], well: [0.24, 0.38] },
  }) },
  // the Miner: a pair under the cockpit's sides (their wells going up between the cockpit's walls and the hull's
  // sides), and the aft pair under the stern's block, beside the engine room; 13 cm longer (STAND)
  miner: { floor: -0.13, legs: mirror({
    'nose port': { at: [1.38, 3.75], top: 2.72, belly: 1.54, r: 0.155, pad: [0.32, 0.5], well: [0.17, 0.3], sink: 0.32 },
    port: { at: [1.38, -6.42], top: 3.6, belly: 1.88, r: 0.155, pad: [0.32, 0.48], well: [0.17, 0.28], sink: 0.45, up: true },
  }) },
};
// EVERY SHIP'S FEET [x, z] (nose +z), for the rule that each stands on legs fore and aft: the two above from LEGS, the
// Medic's from its legs' wells (medic-built.hull.js WELLS: front z 4.33 to 6.16, rear -4.43 to -2.66) and the
// Hauler's from its legs (hauler-built.js GEAR.at); the tests check these against the ships' own data
export const FEET = {
  explorer: Object.values(LEGS.explorer.legs).map((L) => L.at),
  miner: Object.values(LEGS.miner.legs).map((L) => L.at),
  medic: [[1.81, 5.24], [-1.81, 5.24], [2.01, -3.55], [-2.01, -3.55]],
  hauler: [[0.32, 5.25], [-0.32, 5.25], [1.5, -4.4], [-1.5, -4.4]],
};
