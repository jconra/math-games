// THE RADIO ANTENNA'S PLAIN NUMBERS (no three.js: the tests read them, and kit/antenna.js draws from them): where it
// stands, its sizes, its arms and anchors, the dish's aim. kit/antenna.js has the drawing and the game's maker's words.
const PI = Math.PI, D2R = PI / 180;
// WHERE IT STANDS: at the very top of the station, on the roof of the control tower, over the control room the job is
// worked from (the game's maker, 2026-11-23, asked where it should stand: "I was thinking it would be at the very top
// of the station, over the control tower"). It takes the place of the plain pole and the white ball that stood there.
// THE TOWER'S TOP, MEASURED in the game (~/pw/space-math/rigs/antenna-2/measure2.cjs, straight down onto the plated
// hull every 0.1 m): a flat square 4.8 m across at 63 m (kit/outside-plan.js SPIRE_TOP; the tower's wall 3.4 m out from
// its middle comes in to it over the last metre), and on it a big plate 0.32 m proud, 4.2 m east to west and 3 m north
// to south, which the footing stands on.
export const TOWER_TOP = { x: 40, z: 25, y: 63, half: 2.4, plate: { up: 0.32, x: 2.1, z: 1.5 }, wall: 3.4, shoulder: 62 };
// So the mast and its 2 m footing fit; the plan's anchors, 5 m out, do not: the roof ends 2.4 m out. Anchors on the roof
// itself would leave the cables running almost straight down the mast (1.4 m out over 6 and 12 m), so the plan is kept
// as approved (anchors 5 m out, a top cable 13 m: the cards' numbers) and THREE ARMS carry the anchors out past the
// roof's edge, each bolted down on the roof and propped from the tower's wall below.
//   at      the footing's middle [x, y, z] in the station's frame: the tower's middle, on the big plate's top
//   half    the footing: pads at the corners of a 2 m square
//   sec, n  eight sections of 1.5 m: 12 m
//   out     the anchors: 5 m out from the footing's middle, at these bearings (degrees from east toward south): three
//           even ways round: one due south, one west-north-west, one east-north-east (so each arm leaves the footing
//           between two of its pads, and its shoe lies whole on the big plate)
//   drop    each anchor's foot above the footing's (they stand on their arms' ends)
//   arm     each arm: a tube from `from` m out (one for each bearing: just clear of the footing's pads) to past its
//           anchor, its middle `y` over the plate, `r` thick; a `shoe` [long, wide] bolted to the plate under its inner
//           end; a saddle under it at the roof's edge; a prop of `prop` thick from under its end down to the tower's
//           wall, `foot` m below the plate
//   holds   the heights the cables hold the mast at: three at each
//   dish    the new dish: its bowl's radius, its tilt up and its turn round from the station's bow (east), toward south
//   old     the old antenna: a small dish on a 3 m pole, on the roof's bow side beside where the new one goes, between
//           two arms (taken down once the new dish is on), its dish facing the bow (east)
//   tip     the red light at the very top (the station's highest point, as the old pole's tip was): on a slim rod up
//           from the mast's north-east corner, clear of the dish as it turns, `h` m over the footing
export const ANTENNA = {
  at: [TOWER_TOP.x, TOWER_TOP.y + TOWER_TOP.plate.up, TOWER_TOP.z],
  half: 1, sec: 1.5, n: 8, out: 5, bearings: [90, 210, 330], drop: [0.2, 0.2, 0.2], holds: [6, 12],
  arm: { from: [1.11, 1.55, 1.55], shoe: [0.4, 0.34], to: 5.2, y: 0.125, r: 0.075, prop: 0.05, foot: 3.3 },
  dish: { r: 0.8, deep: 0.24, tilt: 30, turn: 135, post: 0.7 },
  old: { at: [1.72, 0, 0.45], pole: 3, r: 0.32 },
  tip: { at: [1, -1], h: 14.6, r: 0.11, rod: 0.022 },
  post: 0.055, strut: 0.035, cable: 0.022,
};
export const TOP = ANTENNA.sec * ANTENNA.n;   // 12 m
// the anchors' places in the frame [x, z]
export const anchorsAt = () => ANTENNA.bearings.map((b) => [ANTENNA.out * Math.cos(b * D2R), ANTENNA.out * Math.sin(b * D2R)]);
// the way out along each arm [x, z] (a unit)
export const armWays = () => ANTENNA.bearings.map((b) => [Math.cos(b * D2R), Math.sin(b * D2R)]);
// how far out along a way [ux, uz] a square of half-width h about the middle reaches (the mast's own side; the roof's
// edge; the tower's wall)
export const squareOut = (ux, uz, h) => h / Math.max(Math.abs(ux), Math.abs(uz));
// where a cable leaves the mast: on its own side facing the anchor at bearing `b` (degrees), `h` m up
export const cableFrom = (b, h) => { const ux = Math.cos(b * D2R), uz = Math.sin(b * D2R), k = squareOut(ux, uz, ANTENNA.half) + 0.05; return [ux * k, h, uz * k]; };
// the corners of the mast (the footing's pads), going round: north-west, north-east, south-east, south-west
export const corners = () => { const h = ANTENNA.half; return [[-h, -h], [h, -h], [h, h], [-h, h]]; };
// the faces, each between two corners: 0 north, 1 east, 2 south, 3 west
export const FACES = 4;

// where the dish's own frame stands on the mast: the turntable's top
export const DISH_FOOT = () => [0, TOP + 0.08 + ANTENNA.dish.post + 0.04, 0];
export const DISH_PIVOT = 0.42;   // (its tilt is about a line this far up its yoke)
// the dish as aimed: turned `turn` degrees from east toward south, tilted `tilt` up -> { yaw, pitch } for its two parts
// (the yoke turns about y; the bowl, on the yoke, tilts about the yoke's own x). In its own frame the bowl faces +z,
// so a yaw of 0 faces south; the bearing from east toward south is turned into it here.
export const dishPose = (turn = ANTENNA.dish.turn, tilt = ANTENNA.dish.tilt) => ({ yaw: (90 - turn) * D2R, pitch: -tilt * D2R });
// how high over the footing anything of the dish reaches, however it is turned (its rim's top, tilted as it is aimed)
export const DISH_TOP = () => DISH_FOOT()[1] + DISH_PIVOT + ANTENNA.dish.r * Math.cos(ANTENNA.dish.tilt * D2R) + ANTENNA.dish.deep * Math.sin(ANTENNA.dish.tilt * D2R);
