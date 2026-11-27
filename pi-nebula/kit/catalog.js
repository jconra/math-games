// THE CATALOG: every piece the kit has, its variants, and how it sits on the grid.
//   at     'cell' (centred on a cell), 'edge' (on a cell edge, facing +z), 'point' (on a grid point), 'wall' (hangs
//          on a wall panel's face: the layout adds the panel's depth), 'free' (placed by `off` alone)
//   foot   how much room it takes, for the lab's framing [w, h, d] in metres
//   prefab a piece made of other pieces (a list of placements relative to it)
import { floorTile, ceilingTile, wallPanel, rib, beam, trim, corner, hatch } from './shell.js';
import { breaker, jbox, extinguisher, wallScreen, label, pipe, cableTray, musicLines, MUSIC_LINES } from './wallkit.js';
import { linesLength } from './musiclines.js';
import { LABELS, SIGNS } from './tex.js';
import { pane, filler } from './windows.js';
import { column, ceilBig, catwalk, rail, plinth, stairs, ramp, opening, plazaTile } from './bigroom.js';
import { bayDoor, mark, airlock, crate, fuel, gangway } from './hangar.js';
import { bunk, cabinet, desk, chair, counter, table, dispenser, booth, jobs, kiosk, sign, planter, divider, pot } from './furniture.js';
import { WARD_PIECES } from './ward.js';         // (the ward: bed wall panels, curtains, bedside tables, drip stands, carts)
import { ship } from './ship.js';
import { OUTSIDE } from './shipparts/outside.cat.js';
import { COCKPIT } from './shipparts/cockpit.cat.js';
import { CABIN } from './shipparts/cabin.cat.js';
import { STATION2 } from './station2.js';
import { SMELTER_PIECES } from './smelter.js';   // (the smelter's ore line in the Miner hangar: crane, sockets, rack, operator's chair)
import { ARENA_PIECES } from './arena.js';       // (the arena: Mathball's court, inside the square in the loop)
import { LIFT_PIECES } from './lift.js';         // (the lift: one box at each of its three stops)
import { TOWER_PIECES } from './tower.js';       // (the control room at the top of the tower, and its desks)
import { STORE_PIECES } from './store.js';       // (the store room on the lower level: its walls, racks, pallets, scale, benches, desk)
import { growPod, growPodSize } from './shipparts/cabin/growpod.js';
import { part, placeInto } from './shipparts/place.js';
import { FACE } from './shipparts/cabin/ship.js';

// THE GROW PODS IN A STATION WALL: the ships' own piece (kit/shipparts/cabin/growpod.js, the rotary garden the game's
// maker chose: "The rotary garden looks awesome"), a row of them on a mounting plate hung on a wall panel. The game's
// maker (2026-11-10): "It might be cool to have some of those plant pods in the station cafeteria area also (and the
// other ships)". Drawn with the row's middle at x = 0, its bottom at y = 0 (the layout lifts it with `off`), its back on
// the panel's face. A station panel's slabs stand up to 2.5 cm out of its face, past a pod's glass (1.45 cm out), so the
// row stands on a plate (POD_MOUNT: `mount` metres thick, its surface `look`, `edge` metres round the frames) and no slab
// crosses a pod's glass. Each variant a row: its pods' size, how many, the gap between their frames, which garden
// (seed), and `rings` (three: the deepest ring, faint behind the frost, left out to keep it cheap, as in the Medic).
export const STATION_PODS = {
  pair: { size: 0.40, n: 2, gap: 0.234, rings: 3, seed: 1 },
  'pair 2': { size: 0.40, n: 2, gap: 0.234, rings: 3, seed: 2 },
};
const POD_MOUNT = { mount: 0.03, edge: 0.04, look: 'grey2' };
export const GROUPS = ['Shell', 'Wall kit', 'Windows', 'Big rooms', 'Furniture', 'Hangar', 'Medical', 'Lift', 'Tower', 'Cargo'];
// the ship parts (kit/shipparts/*.cat.js), on the Kit Lab's own "Ship parts" tab: reusable parts the ships are built from
export const SHIP_GROUPS = ['Ship outside', 'Ship cockpit', 'Ship cabin'];
export const PIECES = {
  floor: { name: 'Floor tile', group: 'Shell', at: 'cell', variants: ['walk', 'tread', 'grating', 'vent', 'deck', 'walkL', 'plaza', 'plaza2'], foot: [2, 0.1, 2], build: (p, v) => (v.startsWith('plaza') ? plazaTile(p, v) : floorTile(p, v)) },
  ceiling: { name: 'Ceiling tile', group: 'Shell', at: 'cell', variants: ['panel', 'light', 'tray'], foot: [2, 0.4, 2], build: ceilingTile, y: 2.8 },
  wall: { name: 'Wall panel', group: 'Shell', at: 'edge', variants: ['plain', 'dark', 'locker', 'window', 'door', 'locked'], foot: [2, 3, 0.3], build: wallPanel },
  rib: { name: 'Rib', group: 'Shell', at: 'point', variants: ['strip', 'plain'], foot: [0.3, 3, 0.7], build: rib },
  beam: { name: 'Ceiling beam', group: 'Shell', at: 'edge', variants: ['plain'], foot: [2, 0.2, 0.3], build: beam, y: 2.9 },
  hatch: { name: 'Bulkhead hatch', group: 'Shell', at: 'point', variants: ['arch', 'wide', 'blind'], foot: [4, 3, 0.6], build: hatch },
  corner: { name: 'Corner', group: 'Shell', at: 'point', variants: ['inside', 'outside', 'inside dark'], foot: [0.6, 3, 0.6], build: corner },
  junction: { name: 'Junction', group: 'Shell', at: 'point', variants: ['T', 'X'], foot: [4, 3, 4], prefab: junction },
  trim: { name: 'Trim', group: 'Shell', at: 'edge', variants: ['base', 'glow', 'cornice', 'cornice-grey'], foot: [2, 0.4, 0.6], build: trim },
  breaker: { name: 'Breaker panel', group: 'Wall kit', at: 'wall', variants: ['switches'], foot: [0.45, 0.9, 0.15], build: breaker },
  jbox: { name: 'Junction box', group: 'Wall kit', at: 'wall', variants: ['plain'], foot: [0.4, 0.7, 0.17], build: jbox },
  extinguisher: { name: 'Extinguisher', group: 'Wall kit', at: 'wall', variants: ['red'], foot: [0.2, 0.6, 0.2], build: extinguisher },
  screen: { name: 'Wall screen', group: 'Wall kit', at: 'wall', variants: ['math', 'status', 'terminal', 'radar', 'music'], foot: [0.6, 0.4, 0.1], build: wallScreen },
  lines: { name: 'Music lines', group: 'Wall kit', at: 'edge', variants: MUSIC_LINES.lens, accepts: (v) => linesLength(v) > 0, foot: [1.8, 0.5, 0.8], build: musicLines, y: 2.6 },
  label: { name: 'Stencil label', group: 'Wall kit', at: 'wall', variants: LABELS.flatMap((l) => [l, l + ' dark']), foot: [0.45, 0.12, 0.01], build: label },
  pipe: { name: 'Pipe run', group: 'Wall kit', at: 'free', variants: ['straight', 'elbow', 'elbow-r', 'elbow-in', 'elbow-in-r', 'flange', 'sleeve', 'valve'], foot: [2, 0.4, 0.4], build: pipe },
  tray: { name: 'Cable tray', group: 'Wall kit', at: 'wall', variants: ['cables'], foot: [2, 0.25, 0.25], build: cableTray },
  sign: { name: 'Lit sign', group: 'Wall kit', at: 'wall', variants: SIGNS.flatMap((n) => [n, n + ' big']), foot: [2.4, 0.6, 0.1], build: sign },
  growpod: { name: 'Grow pods', group: 'Wall kit', at: 'wall', variants: Object.keys(STATION_PODS), foot: [1.3, 0.6, 0.08], build: stationGrowPods },
  // windows: wall panels with a window band at eye level; a run is end-left + middles + end-right (a stadium)
  pane: { name: 'Window wall', group: 'Windows', at: 'edge', variants: ['middle', 'end-left', 'end-right', 'single', 'short', 'long'], foot: [2, 3, 0.4], build: pane },
  // big rooms (two storeys, 7 m: the ordinary panels stacked, deck 0 and deck 1, the filler band between)
  filler: { name: 'Band between storeys', group: 'Big rooms', at: 'edge', variants: ['band', 'ledge'], foot: [2, 1.2, 0.8], build: filler, y: 3.2 },
  column: { name: 'Column', group: 'Big rooms', at: 'point', variants: ['round', 'square', 'post'], foot: [0.8, 7, 0.8], build: column },
  ceilbig: { name: 'Big ceiling', group: 'Big rooms', at: 'cell', variants: ['coffer', 'light', 'truss', 'hangar', 'deck'], foot: [2, 1.3, 2], build: ceilBig, y: 6.6 },
  catwalk: { name: 'Catwalk', group: 'Big rooms', at: 'cell', variants: ['run', 'corner', 'end', 'bridge', 'landing'], foot: [2, 1.4, 2], build: catwalk, y: 4.4 },
  rail: { name: 'Railing', group: 'Big rooms', at: 'edge', variants: ['run', 'end'], foot: [2, 1.1, 0.2], build: rail },
  plinth: { name: 'Raised floor edge', group: 'Big rooms', at: 'edge', variants: ['face'], foot: [2, 0.72, 0.2], build: plinth },
  stairs: { name: 'Stairs', group: 'Big rooms', at: 'cell', variants: ['flight', 'step4'], foot: [2, 5, 6], build: stairs },
  ramp: { name: 'Ramp', group: 'Big rooms', at: 'cell', variants: ['ramp3'], foot: [2, 1.8, 6], build: ramp },
  opening: { name: 'Wide opening', group: 'Big rooms', at: 'point', variants: ['open'], foot: [4, 3, 0.8], build: opening },
  // furniture (placed freely, by cell, turn and off)
  bunk: { name: 'Bunk', group: 'Furniture', at: 'free', variants: ['single', 'double'], foot: [2.1, 2.2, 1], build: bunk },
  cabinet: { name: 'Locker', group: 'Furniture', at: 'free', variants: ['tall', 'double'], foot: [1.2, 2.1, 0.6], build: cabinet },
  desk: { name: 'Desk', group: 'Furniture', at: 'free', variants: ['screen'], foot: [1.4, 1.4, 0.7], build: desk },
  chair: { name: 'Seat', group: 'Furniture', at: 'free', variants: ['desk', 'stool', 'bar', 'bench'], foot: [0.6, 1.1, 0.6], build: chair },
  counter: { name: 'Counter', group: 'Furniture', at: 'free', variants: ['serve', 'plain', 'end'], foot: [2, 1.6, 0.9], build: counter },
  table: { name: 'Table', group: 'Furniture', at: 'free', variants: ['round', 'set', 'long'], foot: [2, 0.8, 1], build: table },
  dispenser: { name: 'Drinks dispenser', group: 'Furniture', at: 'free', variants: ['drinks'], foot: [0.9, 2, 0.6], build: dispenser },
  pot: { name: 'Pot of soup', group: 'Furniture', at: 'free', variants: ['tomato', 'pea'], foot: [0.4, 0.4, 0.5], build: pot },
  booth: { name: "Captain's booth", group: 'Furniture', at: 'free', variants: ['medic', 'mining', 'explore', 'security'], foot: [2, 1.8, 2], build: booth },
  planter: { name: 'Planter', group: 'Furniture', at: 'free', variants: ['long', 'tall'], foot: [1.7, 2.2, 0.7], build: planter },
  jobs: { name: 'Jobs board', group: 'Furniture', at: 'free', variants: ['hang', 'wall', 'menu', 'station', 'pair'], foot: [4.5, 2, 0.3], build: jobs },
  kiosk: { name: 'Ship store kiosk', group: 'Furniture', at: 'free', variants: ['ships'], foot: [0.8, 2, 0.4], build: kiosk },
  divider: { name: 'Bed divider', group: 'Medical', at: 'free', variants: ['plain'], foot: [2, 1.8, 0.45], build: divider },
  ...WARD_PIECES,
  // the hangar
  baydoor: { name: 'Hangar door', group: 'Hangar', at: 'point', variants: ['open'], foot: [16, 7, 5.5], build: bayDoor },
  mark: { name: 'Floor paint', group: 'Hangar', at: 'free', variants: ['ring', 'line', 'hazard', 'box', 'arrow'], foot: [2, 0.1, 2], build: mark },
  airlock: { name: 'Docking airlock', group: 'Hangar', at: 'point', variants: ['inner', 'outer'], foot: [4, 3, 0.7], build: airlock },
  crate: { name: 'Cargo crate', group: 'Hangar', at: 'free', variants: ['small', 'large', 'long', 'stack', 'cart'], foot: [2, 1.3, 1.3], build: crate },
  fuel: { name: 'Fuel line', group: 'Hangar', at: 'free', variants: ['pump', 'pipe', 'elbow', 'hose', 'hose r'], foot: [2, 1.5, 1], build: fuel },
  gangway: { name: 'Boarding stair', group: 'Hangar', at: 'free', variants: ['seven'], foot: [1.3, 2.3, 3.3], build: gangway },
  ship: { name: 'Shuttle (a stand-in)', group: 'Hangar', at: 'free', variants: ['kestrel'], foot: [9.7, 4.8, 11.2], build: ship },
  // the station's build-out (kit/station2.js): the big hangars' door, pad and lamps, a third storey, stand-ins
  ...STATION2,
  ...OUTSIDE, ...COCKPIT, ...CABIN,
  ...SMELTER_PIECES,
  ...ARENA_PIECES,
  ...LIFT_PIECES, ...TOWER_PIECES, ...STORE_PIECES,
};

// A junction square, 2 x 2 cells round a grid point: the floors make a walkway cross, the ceilings a light over each
// cell, and an outside corner post stands at each corner where two corridors meet. 'T' leaves the -z side walled (a
// wall panel on each of its two cells, with ribs; the corridors' own walls carry on from its ends); 'X' is open all round.
function junction(v) {
  const out = [];
  // the four cells round the point, each turned so its walkway corner (grating on its -z and -x edges) faces in
  for (const [cx, cz, t] of [[0.5, 0.5, 0], [-0.5, 0.5, 3], [-0.5, -0.5, 2], [0.5, -0.5, 1]]) {
    out.push({ piece: 'floor', cell: [cx, cz], turn: t, variant: 'walkL' });
    out.push({ piece: 'ceiling', cell: [cx, cz], turn: t, variant: 'light' });
  }
  if (v === 'T') {
    // the closed side: two wall panels, their trim and three ribs; the corridors' own walls carry on from its ends
    for (const cx of [-0.5, 0.5]) for (const [piece, variant] of [['wall', 'plain'], ['trim', 'base'], ['trim', 'cornice']]) out.push({ piece, cell: [cx, -1], turn: 0, variant });
    for (const cx of [-1, 0, 1]) out.push({ piece: 'rib', cell: [cx, -1], turn: 0, variant: 'strip' });
    out.push({ piece: 'corner', cell: [-1, 1], turn: 1, variant: 'outside' }, { piece: 'corner', cell: [1, 1], turn: 2, variant: 'outside' });
  } else {
    for (const [cx, cz, t] of [[-1, -1, 0], [1, -1, 3], [1, 1, 2], [-1, 1, 1]]) out.push({ piece: 'corner', cell: [cx, cz], turn: t, variant: 'outside' });
  }
  return out;
}

export const pieceList = (group) => Object.entries(PIECES).filter(([, d]) => !group || d.group === group).map(([id]) => id);

function stationGrowPods(p, v) {
  const o = { ...(STATION_PODS[v] || STATION_PODS.pair), plate: false }, [w, h] = growPodSize(o), { mount, edge, look } = POD_MOUNT;
  p.slab(look, -w / 2 - edge, w / 2 + edge, 0, h + 2 * edge, 0, mount, { r: 0.012 });
  placeInto(p, part(growPod, { ...o, y: +(h / 2 + edge).toFixed(4) }), { at: [0, 0, mount - FACE] });
}
