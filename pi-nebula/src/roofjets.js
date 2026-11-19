// THE SMALL SHIPS ON THE ROOF'S LANDING PADS: which pads have one, and where it stands. No page, no three.js: node
// tests it (tests/roofjets.test.mjs). The drawing is src/outside.js.
//
// THE GAME'S MAKER (2026-11-19): "another idea I was thinking was to take the small jets that I have in my portfolio
// hanger and put a couple of them on the pads that are on the roof. They could just fly by once in a while out the
// window if you were in the control tower." Of his two, "the bottom fighter (with the canopy closed). That is the one
// I'd really like to use." And: "Can we go ahead and put the 1.4 MB jets on a couple of the 4 roof pads (you could make
// it 50/50 each time the station exterior loads)."
// SO: his own closed-canopy fighter (assets/ships/fighter.glb: taken out of his pair, 4,622 triangles, his picture
// untouched), on each of the four pads or not, a coin tossed for every pad from the outside's own seed, so the pads
// change from one start of the game to the next (as the lit windows do). Parked nose out: over the hangars' side from
// the two pads on the body's roof, over the dock from the two on the west top; each turned a little its own way, as
// something parked by hand is. (Flying past the control room's windows is for when there is a control room.)
import { PADS, SHELL_PADS } from '../kit/outside-plan.js';

// its length, width and height as it stands (m; the file is one unit long, nose along +x), how far its turn may be off
// (radians), and how long after the outside is made the file is fetched (ms: the game's start is no slower for it)
export const JET = { file: '../assets/ships/fighter.glb', long: 10, wide: 7.6, tall: 2, turn: 0.2, wait: 4000 };

// a number from 0 to 1 that is always the same for the same seed and the same k
const toss = (seed, k) => { const v = Math.sin((seed + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };

// the four pads, in a fixed order: [{ name, x, z, top (the pad's own top, m), yaw (the way a ship parks on it) }]
export const JET_PADS = [...PADS.map((p) => ({ ...p, yaw: 0 })), ...SHELL_PADS.map((p) => ({ ...p, yaw: Math.PI }))]
  .map((p) => ({ name: p.name, x: p.at[0], z: p.at[1], top: p.y + p.tall + 0.05, yaw: p.yaw, half: p.half || [p.square, p.square] }));

// the ships for a seed: [{ pad (its name), at: [x, y, z] (the middle of its foot), yaw }]
export function jetsFor(seed) {
  const out = [];
  JET_PADS.forEach((p, i) => { if (toss(seed, i) < 0.5) out.push({ pad: p.name, at: [p.x, p.top, p.z], yaw: p.yaw + (toss(seed, i + 11) - 0.5) * 2 * JET.turn }); });
  return out;
}

// a parked ship as something a flown one bumps into: a plain box of its size, as a list of triangles in the station's
// own frame (what src/flysolid.js takes)
export function jetBox(j) {
  const c = Math.cos(j.yaw), s = Math.sin(j.yaw), position = new Float32Array(24);
  for (let i = 0; i < 8; i++) {
    const lx = (i & 1 ? 1 : -1) * JET.long / 2, ly = i & 2 ? JET.tall : 0, lz = (i & 4 ? 1 : -1) * JET.wide / 2;
    position[i * 3] = j.at[0] + c * lx + s * lz; position[i * 3 + 1] = j.at[1] + ly; position[i * 3 + 2] = j.at[2] - s * lx + c * lz;
  }
  return { position, index: new Uint32Array([0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5]) };
}
