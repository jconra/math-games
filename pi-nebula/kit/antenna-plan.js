// THE RADIO ANTENNA'S PLAIN NUMBERS (no three.js: the tests read them, and kit/antenna.js draws from them): where it
// stands, its sizes, its anchors on the roof, the dish's aim. kit/antenna.js has the drawing and the game's maker's words.
const PI = Math.PI, D2R = PI / 180;
// WHERE IT STANDS: at the very top of the station, on the roof of the control tower, over the control room the job is
// worked from (the game's maker, 2026-11-23, asked where it should stand: "I was thinking it would be at the very top
// of the station, over the control tower"). It takes the place of the plain pole and the white ball that stood there.
// THE TOWER'S TOP, MEASURED in the game (~/pw/space-math/rigs/antenna-2/measure2.cjs, straight down onto the plated
// hull every 0.1 m): a flat square 4.8 m across at 63 m (kit/outside-plan.js SPIRE_TOP; the tower's wall 3.4 m out from
// its middle comes in to it over the last metre), and on it a big plate 0.32 m proud, 4.2 m east to west and 3 m north
// to south, which the footing stands on.
export const TOWER_TOP = { x: 40, z: 25, y: 63, half: 2.4, plate: { up: 0.32, x: 2.1, z: 1.5 }, wall: 3.4, shoulder: 62 };
// So the mast and its 2 m footing fit; the plan's anchors, 5 m out, do not: the roof ends 2.4 m out. Round 2 carried
// them out past the roof's edge on three arms; the game's maker chose none (2026-11-24, asked "out to three arms, or
// short ones down to the roof?": "B: No arms: short steep cables to the roof's corners, and that one card's numbers
// change"). So the anchors stand on the roof itself, 2.5 m out toward three of its corners, and the cables run short
// and steep from the mast's corners down to them; the older children's cable card is 6 m up, 2.5 m out: a 6.5 m cable.
//   at      the footing's middle [x, y, z] in the station's frame: the tower's middle, on the big plate's top
//   half    the footing: pads at the corners of a 2 m square
//   sec, n  eight sections of 1.5 m: 12 m
//   out     the anchors: 2.5 m out from the footing's middle, at these bearings (degrees from east toward south):
//           toward the roof's south-east, south-west and north-west corners (the north-east one has the red light's rod
//           over it), each in line with a corner of the mast, the cables leaving from that corner
//   drop    each anchor's foot above the footing's (they stand on the roof's lower plates there, 63.0 to 63.22 m: the
//           anchor's block goes down to the lowest)
//   holds   the heights the cables hold the mast at: three at each
//   dish    the new dish: its bowl's radius, its tilt up and its turn round from the station's bow (east), toward south
//   old     the old antenna: a small dish on a 3 m pole, on the roof's bow side beside where the new one goes, clear of
//           the cables (taken down once the new dish is on), its dish facing the bow (east)
//   tip     the red light at the very top (the station's highest point, as the old pole's tip was): on a slim rod up
//           from the mast's north-east corner, clear of the dish as it turns, `h` m over the footing
export const ANTENNA = {
  at: [TOWER_TOP.x, TOWER_TOP.y + TOWER_TOP.plate.up, TOWER_TOP.z],
  half: 1, sec: 1.5, n: 8, out: 2.5, bearings: [45, 135, 225], drop: [-0.1, -0.1, -0.1], holds: [6, 12],
  dish: { r: 0.8, deep: 0.24, tilt: 30, turn: 135, post: 0.7 },
  old: { at: [1.72, 0, 0.45], pole: 3, r: 0.32 },
  tip: { at: [1, -1], h: 14.6, r: 0.11, rod: 0.022 },
  post: 0.055, strut: 0.035, cable: 0.022,
};
export const TOP = ANTENNA.sec * ANTENNA.n;   // 12 m
// the anchors' places in the frame [x, z]
export const anchorsAt = () => ANTENNA.bearings.map((b) => [ANTENNA.out * Math.cos(b * D2R), ANTENNA.out * Math.sin(b * D2R)]);
// how far out along a way [ux, uz] a square of half-width h about the middle reaches (the mast's own side; the roof's
// edge)
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

// WHAT A SHIP FLOWN BY HAND BUMPS INTO at the tower's top: what stands there for the crew member playing, as plain
// boxes (as the roof's parked small ships are: src/roofjets.js jetBox), triangle lists in the station's frame for
// src/flysolid.js. `built`: the steps that crew member has built (0..8; a repaired radio tower is all 8), as
// src/jobs/antennalink.js shows them: the old dish on its pole until the new dish goes on (the seventh step); the
// footing's pads (the second); the first section (the third and fourth); the whole mast, its top plate and the rod of
// the light at the very top (the fifth); the anchors and the cables (the sixth); the dish (the seventh). The faint plan
// of the first step is not solid.
const BOX_TRIS = [0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5];
// (a box from corner to corner, upright: [x0, y0, z0] to [x1, y1, z1])
export function boxOf([x0, y0, z0], [x1, y1, z1]) {
  const position = new Float32Array(24);
  for (let i = 0; i < 8; i++) { position[i * 3] = i & 1 ? x1 : x0; position[i * 3 + 1] = i & 2 ? y1 : y0; position[i * 3 + 2] = i & 4 ? z1 : z0; }
  return { position, index: new Uint32Array(BOX_TRIS) };
}
// (a box along the line from a to b, `r` out from it each way)
export function boxAlong(a, b, r) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, u = d.map((v) => v / L);
  const up = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const s0 = cross(u, up), ls = Math.hypot(...s0), s = s0.map((v) => v / ls), t = cross(s, u), position = new Float32Array(24);
  for (let i = 0; i < 8; i++) {
    const e = i & 1 ? b : a, ks = (i & 2 ? 1 : -1) * r, kt = (i & 4 ? 1 : -1) * r;
    for (let c = 0; c < 3; c++) position[i * 3 + c] = e[c] + s[c] * ks + t[c] * kt;
  }
  return { position, index: new Uint32Array(BOX_TRIS) };
}
export function standingBoxes(built = 0) {
  const has = (k) => built > k, list = [], H = ANTENNA.half, P = H + ANTENNA.post, [ox, , oz] = ANTENNA.old.at, pole = ANTENNA.old.pole;
  const sq = (r, y0, y1, x = 0, z = 0) => boxOf([x - r, y0, z - r], [x + r, y1, z + r]);
  // the old dish on its 3 m pole (its base plate, the pole, its small dish at the top facing east)
  if (!has(6)) list.push(sq(0.3, 0, 0.06, ox, oz), sq(0.06, 0, pole, ox, oz), boxOf([ox - 0.02, pole - 0.22, oz - 0.34], [ox + 0.48, pole + 0.46, oz + 0.34]));
  // the footing's pads; the mast as far as it stands (to its corner posts' outsides; its top plate)
  if (has(1)) list.push(sq(H + 0.24, 0, 0.18));
  if (has(4)) list.push(sq(P + 0.06, 0, TOP + 0.08));
  else if (has(2)) list.push(sq(P, 0, ANTENNA.sec));
  // the rod and the light at the very top
  if (has(4)) list.push(sq(ANTENNA.tip.r, TOP, ANTENNA.tip.h, ANTENNA.tip.at[0], ANTENNA.tip.at[1]));
  // the anchors on the roof and the six cables down to them
  if (has(5)) anchorsAt().forEach(([x, z], k) => {
    const y = ANTENNA.drop[k];
    list.push(sq(0.22, y - 0.24, y + 0.35, x, z));
    for (const h of ANTENNA.holds) list.push(boxAlong(cableFrom(ANTENNA.bearings[k], h), [x, y + 0.27, z], 0.04));
  });
  // the dish on its turntable, however it is turned (it reaches no further out than the mast's top plate)
  if (has(6)) list.push(sq(P + 0.06, TOP + 0.08, DISH_TOP() + 0.05));
  // (into the station's frame)
  for (const b of list) for (let i = 0; i < b.position.length; i += 3) { b.position[i] += ANTENNA.at[0]; b.position[i + 1] += ANTENNA.at[1]; b.position[i + 2] += ANTENNA.at[2]; }
  return list;
}
