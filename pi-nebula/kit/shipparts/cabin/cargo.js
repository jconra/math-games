// THE CARGO BAY'S FLOOR: roller lanes the kit's pallets (hangar.js's crate 'stack': 1.56 x 1.3 m on dark skids) roll
// along on their mover, and tie-down rails to strap them to. Both lie on the deck (y = 0), along x (the way the pallets
// roll, up the ramp and into the bay), centred on their origin.
//   rollerLane(p, o)  { len (5.5), wid (2.0), pitch (0.25: from one row of rollers to the next), rows (3: rollers
//                     across the lane), guide (true: a low yellow-and-charcoal guide rail along each edge) }. A pallet
//                     rides on the rollers' tops, ROLLER_TOP above the deck.
//   tieDown(p, o)     a rail let into the deck with an anchor slot every 0.125 m and a fold-down ring every 0.5 m:
//                     { len (5.5) }
import { lean } from '../cabin.js';

export const ROLLER_TOP = 0.03;
const PI = Math.PI;
// (both drawn lean, as the ship's shell is: a hauler has two lanes and four rails, each 5.5 m)
export const rollerLane = lean(function rollerLane(p, o = {}) {
  const { len = 5.5, wid = 2.0, pitch = 0.25, rows = 3, guide = true } = o, hl = len / 2, hw = wid / 2, R = 0.028, cy = ROLLER_TOP - R;
  // the lane's bed: a charcoal frame let into the deck, a dark trough under each row of rollers
  const span = wid / rows;
  for (let j = 0; j < rows; j++) {
    const z0 = -hw + j * span + 0.03, z1 = -hw + (j + 1) * span - 0.03;
    p.slab('dark', -hl, hl, -0.03, -0.004, z0, z1, { r: 0.004, cell: 1.2 });
    for (const z of [z0, z1]) p.slab('black', -hl, hl, -0.03, 0.012, z - 0.012, z + 0.012, { r: 0.004, cell: 1.2 });
  }
  // the rollers: bare metal, their axles across the lane (a pallet rolls along x)
  const n = Math.max(1, Math.floor(len / pitch + 1e-6)), x0 = -hl + (len - n * pitch) / 2 + pitch / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * pitch;
    for (let j = 0; j < rows; j++) { const z0 = -hw + j * span + 0.045, z1 = -hw + (j + 1) * span - 0.045; p.cyl('rail', R, z1 - z0, [x, cy, (z0 + z1) / 2], [PI / 2, 0, 0], 7); }
  }
  // guide rails along both edges, yellow with a charcoal cap (the pallets run between them)
  if (guide) for (const sz of [-1, 1]) {
    const z = sz * (hw + 0.03);
    p.slab('yellow', -hl, hl, 0, 0.07, z - 0.025, z + 0.025, { r: 0.008, cell: 1.0 });
    p.slab('black', -hl, hl, 0.07, 0.085, z - 0.03, z + 0.03, { r: 0.006, cell: 1.0 });
    for (let x = -hl + 0.25; x < hl; x += 1) p.slab('black', x - 0.05, x + 0.05, 0, 0.06, z - sz * 0.045 - 0.015, z - sz * 0.045 + 0.015, { r: 0.005 });
  }
  return p;
});
export const tieDown = lean(function tieDown(p, o = {}) {
  const { len = 5.5 } = o, hl = len / 2;
  p.slab('rail', -hl, hl, -0.02, 0.004, -0.03, 0.03, { r: 0.004, cell: 1.2 });
  for (let x = -hl + 0.0625; x < hl; x += 0.125) p.slab('dark', x - 0.03, x + 0.03, -0.006, 0.0045, -0.009, 0.009, { r: 0 });
  // a fold-down ring every half metre, lying flat in its slot
  for (let x = -hl + 0.25; x < hl; x += 0.5) {
    p.slab('black', x - 0.04, x + 0.04, 0.0, 0.012, -0.022, 0.022, { r: 0.006 });
    p.box('rail', [0.07, 0.008, 0.012], [x, 0.016, -0.03], null, { r: 0 }); p.box('rail', [0.07, 0.008, 0.012], [x, 0.016, 0.03], null, { r: 0 });
    p.box('rail', [0.012, 0.008, 0.07], [x + 0.035, 0.016, 0], null, { r: 0 });
  }
  return p;
});
