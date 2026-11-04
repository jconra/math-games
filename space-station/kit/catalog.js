// THE CATALOG: every piece the kit has, its variants, and how it sits on the grid.
//   at     'cell' (centred on a cell), 'edge' (on a cell edge, facing +z), 'point' (on a grid point), 'wall' (hangs
//          on a wall panel's face: the layout adds the panel's depth), 'free' (placed by `off` alone)
//   foot   how much room it takes, for the lab's framing [w, h, d] in metres
//   prefab a piece made of other pieces (a list of placements relative to it)
import { floorTile, ceilingTile, wallPanel, rib, beam, trim, corner, hatch } from './shell.js';
import { breaker, jbox, extinguisher, wallScreen, label, pipe, cableTray } from './wallkit.js';
import { LABELS, SIGNS } from './tex.js';
import { pane, filler } from './windows.js';
import { column, ceilBig, catwalk, rail, plinth, stairs, ramp, opening, plazaTile } from './bigroom.js';
import { bayDoor, mark, airlock, crate, fuel, gangway } from './hangar.js';
import { bunk, cabinet, desk, chair, counter, table, dispenser, booth, jobs, sign, planter } from './furniture.js';
import { ship } from './ship.js';

export const GROUPS = ['Shell', 'Wall kit', 'Windows', 'Big rooms', 'Furniture', 'Hangar'];
export const PIECES = {
  floor: { name: 'Floor tile', group: 'Shell', at: 'cell', variants: ['walk', 'tread', 'grating', 'vent', 'deck', 'walkL', 'plaza', 'plaza2'], foot: [2, 0.1, 2], build: (p, v) => (v.startsWith('plaza') ? plazaTile(p, v) : floorTile(p, v)) },
  ceiling: { name: 'Ceiling tile', group: 'Shell', at: 'cell', variants: ['panel', 'light', 'tray'], foot: [2, 0.4, 2], build: ceilingTile, y: 2.8 },
  wall: { name: 'Wall panel', group: 'Shell', at: 'edge', variants: ['plain', 'dark', 'locker', 'window', 'door', 'locked'], foot: [2, 3, 0.3], build: wallPanel },
  rib: { name: 'Rib', group: 'Shell', at: 'point', variants: ['strip', 'plain'], foot: [0.3, 3, 0.7], build: rib },
  beam: { name: 'Ceiling beam', group: 'Shell', at: 'edge', variants: ['plain'], foot: [2, 0.2, 0.3], build: beam, y: 2.9 },
  hatch: { name: 'Bulkhead hatch', group: 'Shell', at: 'point', variants: ['arch', 'wide', 'blind'], foot: [4, 3, 0.6], build: hatch },
  corner: { name: 'Corner', group: 'Shell', at: 'point', variants: ['inside', 'outside'], foot: [0.6, 3, 0.6], build: corner },
  junction: { name: 'Junction', group: 'Shell', at: 'point', variants: ['T', 'X'], foot: [4, 3, 4], prefab: junction },
  trim: { name: 'Trim', group: 'Shell', at: 'edge', variants: ['base', 'glow', 'cornice', 'cornice-grey'], foot: [2, 0.4, 0.6], build: trim },
  breaker: { name: 'Breaker panel', group: 'Wall kit', at: 'wall', variants: ['switches'], foot: [0.45, 0.9, 0.15], build: breaker },
  jbox: { name: 'Junction box', group: 'Wall kit', at: 'wall', variants: ['plain'], foot: [0.4, 0.7, 0.17], build: jbox },
  extinguisher: { name: 'Extinguisher', group: 'Wall kit', at: 'wall', variants: ['red'], foot: [0.2, 0.6, 0.2], build: extinguisher },
  screen: { name: 'Wall screen', group: 'Wall kit', at: 'wall', variants: ['math', 'status', 'terminal', 'radar'], foot: [0.6, 0.4, 0.1], build: wallScreen },
  label: { name: 'Stencil label', group: 'Wall kit', at: 'wall', variants: LABELS.flatMap((l) => [l, l + ' dark']), foot: [0.45, 0.12, 0.01], build: label },
  pipe: { name: 'Pipe run', group: 'Wall kit', at: 'free', variants: ['straight', 'elbow', 'elbow-r', 'elbow-in', 'elbow-in-r', 'flange', 'sleeve', 'valve'], foot: [2, 0.4, 0.4], build: pipe },
  tray: { name: 'Cable tray', group: 'Wall kit', at: 'wall', variants: ['cables'], foot: [2, 0.25, 0.25], build: cableTray },
  sign: { name: 'Lit sign', group: 'Wall kit', at: 'wall', variants: SIGNS.flatMap((n) => [n, n + ' big']), foot: [2.4, 0.6, 0.1], build: sign },
  // windows: wall panels with a window band at eye level; a run is end-left + middles + end-right (a stadium)
  pane: { name: 'Window wall', group: 'Windows', at: 'edge', variants: ['middle', 'end-left', 'end-right'], foot: [2, 3, 0.4], build: pane },
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
  booth: { name: "Captain's booth", group: 'Furniture', at: 'free', variants: ['medic', 'mining', 'explore', 'security'], foot: [2, 1.8, 2], build: booth },
  planter: { name: 'Planter', group: 'Furniture', at: 'free', variants: ['long', 'tall'], foot: [1.7, 2.2, 0.7], build: planter },
  jobs: { name: 'Jobs board', group: 'Furniture', at: 'free', variants: ['hang', 'wall', 'menu'], foot: [4.5, 2, 0.3], build: jobs },
  // the hangar
  baydoor: { name: 'Hangar door', group: 'Hangar', at: 'point', variants: ['open'], foot: [16, 7, 5.5], build: bayDoor },
  mark: { name: 'Floor paint', group: 'Hangar', at: 'free', variants: ['ring', 'line', 'hazard', 'box', 'arrow'], foot: [2, 0.1, 2], build: mark },
  airlock: { name: 'Docking airlock', group: 'Hangar', at: 'point', variants: ['inner', 'outer'], foot: [4, 3, 0.7], build: airlock },
  crate: { name: 'Cargo crate', group: 'Hangar', at: 'free', variants: ['small', 'large', 'long', 'stack', 'cart'], foot: [2, 1.3, 1.3], build: crate },
  fuel: { name: 'Fuel line', group: 'Hangar', at: 'free', variants: ['pump', 'pipe', 'elbow', 'hose'], foot: [2, 1.5, 1], build: fuel },
  gangway: { name: 'Boarding stair', group: 'Hangar', at: 'free', variants: ['seven'], foot: [1.3, 2.3, 3.3], build: gangway },
  ship: { name: 'Shuttle (a stand-in)', group: 'Hangar', at: 'free', variants: ['kestrel'], foot: [9.7, 4.8, 11.2], build: ship },
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
