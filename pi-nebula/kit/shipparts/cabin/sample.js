// A SAMPLE OF A SHIP'S INSIDE, built only from the cabin's parts with placeInto, on the ship grid (0.5 m cells, rooms
// 2.5 m to the ceiling): a corridor 5 m long and two cells wide (1.0 m between its wall lines, 0.94 m clear), a bunk
// room through a doorway on one side, a washroom through a doorway on the other. It shows the parts fit together:
// walls meeting at corners, doorways whose leaves slide into the walls either side, floors and ceilings that close
// the rooms, the station's wall kit on the walls, the bunk, lockers and washroom.
//   sampleRoom(p, o)   { ceiling (true: false leaves the ceilings off, to look in from above) }
// Frame: in grid metres the corridor runs along x from 0 to 5 with its middle on z = 0; the bunk room is on +z (x 1.5
// to 5, z 0.5 to 3.0), the washroom on -z (x 0 to 2, z -2 to -0.5). The whole is moved by SAMPLE_AT so its middle
// sits on the origin.
import { part, placeInto } from '../place.js';
import { wallRun, doorway, corner, frame, floorRun, ceilingRun, onWall, FACING } from '../cabin.js';
import { bunkBed, lockers } from './quarters.js';
import { handhold } from './climb.js';
import { toilet, basin, shower } from './wash.js';
import { extinguisher, wallScreen, breaker, label, pipe } from '../../wallkit.js';
import { FACE } from './ship.js';

const PI = Math.PI;
// (wall-kit pieces at a ship's sizes: the breaker's conduit shorter, a pipe as long as it needs)
const shortBreaker = (p, s) => breaker(p, 'switches', s), longPipe = (p, s) => pipe(p, 'straight', s);
export const SAMPLE_AT = [-2.5, 0, -0.5];
// the sample's rooms in grid metres (before SAMPLE_AT), for the rigs: [x0, z0, x1, z1]
export const SAMPLE_ROOMS = { corridor: [0, -0.5, 5, 0.5], bunks: [1.5, 0.5, 5, 3.0], wash: [0, -2, 2, -0.5] };
export const SAMPLE_DOORS = { bunks: { at: [3.0, 0.5], along: 'x', clear: 0.8 }, wash: { at: [1.0, -0.5], along: 'x', clear: 0.8 } };
export function sampleRoom(p, o = {}) {
  const { ceiling = true } = o, C = SAMPLE_AT;
  const at = (x, y, z) => [x + C[0], y + C[1], z + C[2]];
  // a wall from (x0, z0) to (x1, z1), along x or along z, facing `face`
  const wall = (x0, z0, x1, z1, face, o2 = {}) => {
    const len = +Math.hypot(x1 - x0, z1 - z0).toFixed(3); if (len < 0.01) return;
    placeInto(p, part(wallRun, { len, ...o2 }), { at: at((x0 + x1) / 2, 0, (z0 + z1) / 2), rot: [0, FACING[face], 0] });
  };
  const door = (x, z, face, o2 = {}) => placeInto(p, part(doorway, o2), { at: at(x, 0, z), rot: [0, FACING[face], 0], id: `door ${x},${z}:` });
  const cornerAt = (x, z, turn) => placeInto(p, part(corner, { v: 'inside' }), { at: at(x, 0, z), rot: [0, turn * PI / 2, 0] });
  const hang = (src, x, y, z, face) => onWall(p, src, { at: at(x, y, z), face });

  // ── the corridor: x 0..5, z -0.5..0.5 ──
  wall(0, 0.5, 2.5, 0.5, '-z'); door(3.0, 0.5, '-z'); wall(3.5, 0.5, 5, 0.5, '-z');          // its bunk-room side
  wall(0, -0.5, 0.5, -0.5, '+z'); door(1.0, -0.5, '+z'); wall(1.5, -0.5, 5, -0.5, '+z');     // its washroom side
  wall(0, -0.5, 0, 0.5, '+x'); wall(5, -0.5, 5, 0.5, '-x');                                  // its two ends
  placeInto(p, part(floorRun, { len: 5, wid: 1, v: 'walk' }), { at: at(2.5, 0, 0) });
  if (ceiling) placeInto(p, part(ceilingRun, { len: 5, wid: 1, lights: 1 }), { at: at(2.5, 0, 0) });   // (a corridor lit in every tile)
  for (const [x, z, t] of [[0, -0.5, 0], [5, -0.5, 3], [5, 0.5, 2], [0, 0.5, 1]]) cornerAt(x, z, t);
  for (const x of [2, 4]) placeInto(p, part(frame, { wid: 1 }), { at: at(x, 0, 0) });   // portal frames, the station's rhythm

  // ── the bunk room: x 1.5..5, z 0.5..3.0 ──
  wall(1.5, 0.5, 2.5, 0.5, '+z'); wall(3.5, 0.5, 5, 0.5, '+z');                               // (the doorway is two-faced)
  wall(1.5, 3.0, 5, 3.0, '-z'); wall(1.5, 0.5, 1.5, 3.0, '+x'); wall(5, 0.5, 5, 3.0, '-x');
  placeInto(p, part(floorRun, { len: 3.5, wid: 2.5, v: 'deck' }), { at: at(3.25, 0, 1.75) });
  if (ceiling) placeInto(p, part(ceilingRun, { len: 3.5, wid: 2.5, lights: 2 }), { at: at(3.25, 0, 1.75) });
  for (const [x, z, t] of [[1.5, 0.5, 0], [5, 0.5, 3], [5, 3.0, 2], [1.5, 3.0, 1]]) cornerAt(x, z, t);
  placeInto(p, part(bunkBed, {}), { at: at(2.75, 0, 3.0), rot: [0, PI, 0] });               // along the far wall
  placeInto(p, part(lockers, { n: 3 }), { at: at(5, 0, 1.5), rot: [0, -PI / 2, 0] });       // on the end wall, one each
  hang(part(wallScreen, 'status'), 1.5, 1.15, 1.6, '+x');

  // ── the washroom: x 0..2, z -2..-0.5 ──
  wall(0, -0.5, 0.5, -0.5, '-z'); wall(1.5, -0.5, 2, -0.5, '-z');
  wall(0, -2, 2, -2, '+z'); wall(0, -2, 0, -0.5, '+x'); wall(2, -2, 2, -0.5, '-x');
  placeInto(p, part(floorRun, { len: 2, wid: 1.5, v: 'deck' }), { at: at(1, 0, -1.25) });
  if (ceiling) placeInto(p, part(ceilingRun, { len: 2, wid: 1.5, lights: 1 }), { at: at(1, 0, -1.25) });
  for (const [x, z, t] of [[0, -2, 0], [2, -2, 3], [2, -0.5, 2], [0, -0.5, 1]]) cornerAt(x, z, t);
  placeInto(p, part(shower, {}), { at: at(0.5, 0, -2) });
  placeInto(p, part(toilet, {}), { at: at(1.55, 0, -2) });
  placeInto(p, part(basin, {}), { at: at(2, 0, -0.95), rot: [0, -PI / 2, 0] });

  // ── the station's wall kit on the corridor's walls ──
  hang(part(extinguisher, 'red'), 0, 0.5, 0.25, '+x');                                    // (on the corridor's end wall, out of the way)
  hang(part(label, 'CREW dark'), 4.65, 1.75, 0.5, '-z');                                // (on a flat bay: the panel faces -z, so its upper left bay is at +x)
  hang(part(shortBreaker, { conduit: 0.55 }), 4.5, 1.0, -0.5, '+z');                    // (between the frame at x 4 and the end wall)
  placeInto(p, part(handhold, { upright: true, len: 0.5 }), { at: at(3.7, 0, 0.5), rot: [0, PI, 0] });
  // a pipe along the washroom side, under the cornice, on hangers into it: in through the far end wall (a sleeve flush
  // on it), along between the portal frames, where an elbow turns it up into the ceiling's corner, a collar where it
  // meets the cornice; it stops well short of the washroom's doorway, so it hides neither door's light
  const py = 2.08, pz = -0.5 + 0.176;   // (clear of the portal frames' ribs, 0.104 out from the wall line)
  const ex = 2.75;   // (the elbow: its straight leg x 2.75..3.75, its upright at x 2.55, halfway between the frames)
  placeInto(p, part(pipe, 'elbow-r'), { at: at(ex, py, pz), rot: [PI, 0, 0] });   // (turned over: it turns up, not down)
  placeInto(p, part(longPipe, { len: 5 - ex - 1 }), { at: at((5 + ex + 1) / 2, py, pz) });
  placeInto(p, part(pipe, 'flange'), { at: at(4.3, py, pz) });
  placeInto(p, part(pipe, 'sleeve'), { at: at(ex - 0.2, 2.34, pz), rot: [0, 0, PI / 2] });   // (the collar under the cornice)
  placeInto(p, part(pipe, 'sleeve'), { at: at(5 - FACE - 0.025, py, pz) });   // (where it comes through the end wall)
  return p;
}
