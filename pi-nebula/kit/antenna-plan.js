// THE RADIO ANTENNA'S PLAIN NUMBERS (no three.js: the tests read them, and kit/antenna.js draws from them): where it
// stands on the roof, its sizes, its anchors, the dish's aim. kit/antenna.js has the drawing and the game's maker's words.
const PI = Math.PI, D2R = PI / 180;
// WHERE IT STANDS: on the roof's raised level (kit/outside-plan.js RAISED: 23 m over the hangars' floor), just south-west
// of the control tower's foot, in the open stretch between the tower's base and the raised level's south edge, below
// the control room (the job is worked from its radio desk). The approved drawing put it on "the terminal's roof"; that
// roof has been built over since (the shell over the west rooms, its two landing pads and the walkway between them:
// no stretch there is wide enough for the cables' anchors 5 m out). Its anchors stand on the same flat stretch (each
// checked clear of the tower's base and the raised level's edge: tests/antenna.test.mjs).
//   at      the footing's middle [x, y, z] in the station's frame: on the big raised plate there (the raised level's
//           top is 23 m; its plates stand 0.3 m proud of it, and this big one 0.75 m: measured in the game,
//           ~/pw/space-math/rigs/antenna-1/measure.cjs)
//   half    the footing: pads at the corners of a 2 m square
//   sec, n  eight sections of 1.5 m: 12 m
//   out     the anchors: 5 m out from the footing's middle, at these bearings (degrees from east toward south): one
//           east, two to the west either side (the stretch is 6 m deep, so not three even ways round)
//   drop    each anchor's foot below the footing's (the two to the west stand on the plates round the big one)
//   holds   the heights the cables hold the mast at: three at each
//   dish    the new dish: its bowl's radius, its tilt up and its turn round from the station's bow (east), toward south
//   old     the old antenna: a small dish on a 3 m pole, beside where the new one goes (taken down once the new dish
//           is on), its dish facing the hangars' way (east)
export const ANTENNA = {
  at: [37, 23.75, 36],
  half: 1, sec: 1.5, n: 8, out: 5, bearings: [0, 142, 218], drop: [0, -0.43, -0.47], holds: [6, 12],
  dish: { r: 0.8, deep: 0.24, tilt: 30, turn: 135, post: 0.7 },
  old: { at: [-3.2, 0, 0.6], pole: 3, r: 0.32 },
  post: 0.055, strut: 0.035, cable: 0.014,
};
export const TOP = ANTENNA.sec * ANTENNA.n;   // 12 m
// the anchors' places in the frame [x, z]
export const anchorsAt = () => ANTENNA.bearings.map((b) => [ANTENNA.out * Math.cos(b * D2R), ANTENNA.out * Math.sin(b * D2R)]);
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

