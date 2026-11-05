// THE SHIP PARTS: Ship cabin (the rooms behind the cockpit: bunks, galley, washroom, medical, engineering, science and cargo fittings, inside doors), as the Kit Lab's "Ship parts" tab shows them. Each entry is a catalog piece
// (kit/catalog.js's format: group 'Ship cabin', at 'free', variants, foot [w, h, d] for the lab's framing, build(p, v)),
// each built from this family's reusable part functions (kit/shipparts/), which the ships call directly with their own
// sizes and place with place.js.
//   The walls, doorways, corners, floors, ceilings and the hull's slope are the station's own pieces (kit/shell.js) at a
//   ship's size (kit/shipparts/cabin.js); the fittings are in kit/shipparts/cabin/; the sizes and the look they share
//   are in kit/shipparts/cabin/ship.js. Each variant is a named preset of its part's options (PRESETS).
//   `mount` (read by the rigs) says how a part stands: 'shell' (a wall on its wall line, facing +z: nothing behind the
//   line), 'wall' (a fitting against a wall: nothing behind the wall's face), 'line' (a wall with a face both ways),
//   'corner', 'floor', 'ceiling', 'free' (centred), 'room' (the sample).
//   A room file on the ship grid can ask for any length: `accepts` lets through variants like '3.5 m' or 'dark 3 m'
//   (a wall run), 'walk 4 x 1' or 'deck 3.5 x 2.5' (a floor run, length x width), '4 x 1' or 'unlit 2 x 1' (a ceiling
//   run).
import { wallRun, doorway, corner, floorRun, ceilingRun, hullSlope, bulkhead, onWall } from './cabin.js';
import { bunkBed, lockers } from './cabin/quarters.js';
import { rollerLane, tieDown, ROLLER_TOP } from './cabin/cargo.js';
import { handhold, ladder } from './cabin/climb.js';
import { sampleRoom } from './cabin/sample.js';
import { CABIN_FIT } from './cabin/fit.cat.js';
import { part, placeInto } from './place.js';
import { breaker, jbox, extinguisher, wallScreen, label, pipe, cableTray } from '../wallkit.js';
import { crate } from '../hangar.js';
import { FACE } from './cabin/ship.js';

// the station's wall kit, each on a metre of ship wall (with a ship's shorter conduits and a metre-long pipe and tray)
const WALLKIT = {
  extinguisher: [extinguisher, 'red', [0, 0.5]],
  breaker: [(p, s) => breaker(p, 'switches', s), { conduit: 0.55 }, [0, 1.0]],
  'junction box': [(p, s) => jbox(p, 'plain', s), { conduit: 0.7 }, [0, 1.15]],
  screen: [wallScreen, 'math', [0, 1.15]],
  label: [label, 'CREW dark', [-0.25, 1.75]],   // (a label goes on a flat bay: the upper bay left of the pilaster)
  'pipe on hangers': [null, null, [0, 2.08]],
  'cable tray': [(p, s) => cableTray(p, 'cables', s), { len: 1 }, [0, 2.0]],
};
const kitParts = new Map();
function wallKit(p, o) {
  wallRun(p, { len: 1 });
  const [build, v, [x, y]] = WALLKIT[o.item];
  if (!build) {   // a pipe along the wall under the cornice, on a hanger into it
    const z = FACE + 0.09;
    if (!kitParts.has('pipe')) kitParts.set('pipe', (q, s) => pipe(q, 'straight', s));
    placeInto(p, part(kitParts.get('pipe'), { len: 1 }), { at: [0, y, z] }); placeInto(p, part(pipe, 'flange'), { at: [0, y, z] });
    return p;
  }
  return onWall(p, part(build, v), { at: [x, y, 0], face: '+z' });
}
function slopeWall(p, o) { wallRun(p, { len: o.len ?? 2, top: o.y0 ?? 2.0, cornice: false }); return hullSlope(p, o); }
function lane(p, o) {
  rollerLane(p, o);
  if (o.pallet) placeInto(p, part(crate, 'stack'), { at: [0, ROLLER_TOP, 0], rot: [0, Math.PI / 2, 0] });   // (1.3 m along the lane, 1.56 across)
  return p;
}

export const PRESETS = {
  cabinWall: { '2 m': { len: 2 }, '1 m': { len: 1 }, '0.5 m': { len: 0.5 }, '1.5 m': { len: 1.5 }, 'dark 2 m': { len: 2, v: 'dark' }, 'ribs 3 m': { len: 3, ribs: true }, 'floor glow 2 m': { len: 2, glow: true } },
  cabinDoor: { room: {}, 'room, one leaf': { leaves: -1 }, stretcher: { w: 2, clear: 1.5 }, locked: { locked: true } },
  cabinCorner: { inside: { v: 'inside' }, outside: { v: 'outside' } },
  cabinFloor: { corridor: { v: 'walk', len: 2, wid: 1 }, deck: { v: 'deck', len: 2, wid: 2 }, tread: { v: 'tread', len: 2, wid: 2 }, grating: { v: 'grating', len: 2, wid: 1 }, vent: { v: 'vent', len: 1, wid: 1 }, 'half-metre tiles': { v: 'deck', len: 1, wid: 1, tile: 0.5 } },
  cabinCeiling: { corridor: { len: 2, wid: 1 }, room: { len: 2, wid: 2 }, 'every tile lit': { len: 2, wid: 1, lights: 1 }, unlit: { len: 2, wid: 1, lights: 0 } },
  cabinSlope: { '45 degrees': {}, shallow: { y0: 2.0, run: 0.75 }, low: { y0: 1.75, run: 0.6 } },
  cabinBulkhead: { airlock: {} },
  cabinBunk: { 'set in': {}, unlit: { light: false } },
  cabinLockers: { two: { n: 2 }, three: { n: 3 }, one: { n: 1 } },
  cabinRollers: { 'with a pallet': { len: 2.5, pallet: true }, 'lane 5.5 m': { len: 5.5 } },
  cabinTieDown: { '2 m': { len: 2 }, '5.5 m': { len: 5.5 } },
  cabinHandhold: { along: {}, upright: { upright: true, len: 0.5 } },
  cabinLadder: { 'to the ceiling': {}, 'up to a deck': { h: 1.3 } },
  cabinWallKit: Object.fromEntries(Object.keys(WALLKIT).map((k) => [k, { item: k }])),
  cabinSample: { open: { ceiling: false }, closed: { ceiling: true } },
};
const num = '(\\d+(?:\\.\\d+)?)';
const PARSE = {
  cabinWall: (v) => { const m = new RegExp(`^(?:(dark|ribs|glow) )?${num} m$`).exec(v); return m && { len: +m[2], ...(m[1] === 'dark' ? { v: 'dark' } : m[1] === 'ribs' ? { ribs: true } : m[1] === 'glow' ? { glow: true } : {}) }; },
  cabinFloor: (v) => { const m = new RegExp(`^(walk|deck|tread|grating|vent) ${num} x ${num}$`).exec(v); return m && { v: m[1], len: +m[2], wid: +m[3] }; },
  cabinCeiling: (v) => { const m = new RegExp(`^(?:(unlit|every tile lit) )?${num} x ${num}$`).exec(v); return m && { len: +m[2], wid: +m[3], lights: m[1] === 'unlit' ? 0 : m[1] ? 1 : 2 }; },
};
const entry = (id, name, mount, foot, fn) => ({ name, group: 'Ship cabin', at: 'free', mount, variants: Object.keys(PRESETS[id]), foot,
  build: (p, v) => fn(p, PRESETS[id][v] ?? PARSE[id]?.(v) ?? {}), ...(PARSE[id] ? { accepts: (v) => v in PRESETS[id] || !!PARSE[id](v) } : {}) });
export const CABIN = {
  cabinSample: entry('cabinSample', 'Sample: corridor and rooms', 'room', [5, 2.6, 5], sampleRoom),
  cabinWall: entry('cabinWall', 'Wall run', 'shell', [2, 2.5, 0.3], wallRun),
  cabinDoor: entry('cabinDoor', 'Doorway', 'line', [2, 2.5, 0.3], doorway),
  cabinCorner: entry('cabinCorner', 'Corner', 'corner', [0.5, 2.5, 0.5], corner),
  cabinSlope: entry('cabinSlope', 'Wall under the hull\'s slope', 'shell', [2, 2.5, 0.8], slopeWall),
  cabinFloor: entry('cabinFloor', 'Floor run', 'floor', [2, 0.1, 2], floorRun),
  cabinCeiling: entry('cabinCeiling', 'Ceiling run', 'ceiling', [2, 0.3, 2], ceilingRun),
  cabinBulkhead: entry('cabinBulkhead', 'Airlock hatch', 'line', [2, 2.5, 0.3], bulkhead),
  cabinBunk: entry('cabinBunk', 'Bunk bed, set in', 'wall', [2, 2.5, 1], bunkBed),
  cabinLockers: entry('cabinLockers', 'Lockers', 'wall', [1, 2.1, 0.5], lockers),
  ...CABIN_FIT,
  cabinRollers: entry('cabinRollers', 'Roller lane', 'floor', [2.5, 0.2, 2.1], lane),
  cabinTieDown: entry('cabinTieDown', 'Tie-down rail', 'floor', [2, 0.05, 0.1], tieDown),
  cabinHandhold: entry('cabinHandhold', 'Handhold', 'wall', [0.5, 0.2, 0.1], handhold),
  cabinLadder: entry('cabinLadder', 'Ladder', 'wall', [0.5, 2.5, 0.25], ladder),
  cabinWallKit: entry('cabinWallKit', 'Wall kit on a ship wall', 'shell', [1, 2.5, 0.3], wallKit),
};
