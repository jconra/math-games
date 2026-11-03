// THE CATALOG: every piece the kit has, its variants, and how it sits on the grid.
//   at     'cell' (centred on a cell), 'edge' (on a cell edge, facing +z), 'point' (on a grid point), 'wall' (hangs
//          on a wall panel's face: the layout adds the panel's depth), 'free' (placed by `off` alone)
//   foot   how much room it takes, for the lab's framing [w, h, d] in metres
//   prefab a piece made of other pieces (a list of placements relative to it)
import { floorTile, ceilingTile, wallPanel, rib, beam, trim, corner, hatch } from './shell.js';
import { breaker, jbox, extinguisher, wallScreen, label, pipe, cableTray } from './wallkit.js';
import { LABELS } from './tex.js';

export const GROUPS = ['Shell', 'Wall kit'];
export const PIECES = {
  floor: { name: 'Floor tile', group: 'Shell', at: 'cell', variants: ['walk', 'tread', 'grating', 'vent', 'deck', 'walkL'], foot: [2, 0.1, 2], build: floorTile },
  ceiling: { name: 'Ceiling tile', group: 'Shell', at: 'cell', variants: ['panel', 'light', 'tray'], foot: [2, 0.4, 2], build: ceilingTile, y: 2.8 },
  wall: { name: 'Wall panel', group: 'Shell', at: 'edge', variants: ['plain', 'dark', 'locker', 'window', 'door'], foot: [2, 3, 0.3], build: wallPanel },
  rib: { name: 'Rib', group: 'Shell', at: 'point', variants: ['strip', 'plain'], foot: [0.3, 3, 0.7], build: rib },
  beam: { name: 'Ceiling beam', group: 'Shell', at: 'edge', variants: ['plain'], foot: [2, 0.2, 0.3], build: beam, y: 2.9 },
  hatch: { name: 'Bulkhead hatch', group: 'Shell', at: 'point', variants: ['arch', 'blind'], foot: [4, 3, 0.6], build: hatch },
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
