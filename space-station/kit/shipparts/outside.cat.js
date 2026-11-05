// THE SHIP PARTS: Ship outside (the hull pieces on the ship grid, engines, wings and fins, windows, landing legs,
// doors, ramps and hatches, the outside details and each job's gear), as the Kit Lab's "Ship parts" tab shows them.
// Each entry is a catalog piece (kit/catalog.js's format: group 'Ship outside', at, variants, foot [w, h, d] for the
// lab's framing, build(p, v)). The hull pieces snap to a ship's grid (kit/grid.js SHIP_GRID) in a ship's layout file;
// they take any of their shapes with any paint (`accepts`), the variants below are the ones the lab shows. The free
// parts are each built from this family's part functions (kit/shipparts/outside/*), which the ships call directly
// with their own sizes and place with place.js, or name here by variant.
import { hullPanel, hullSlope, hullAngle, hullCorner, hullCap, hullOpening, ACCEPTS } from './outside/hull.js';

const G = 'Ship outside';
export const OUTSIDE = {
  hullPanel: { name: 'Hull panel', group: G, at: 'edge', foot: [2, 1, 0.5], build: hullPanel, accepts: ACCEPTS.hullPanel,
    variants: ['x1', 'x2', 'x4', 'x4 h2', 'x4 ystripe', 'x4 rstripe', 'x4 tstripe', 'x4 grey', 'x4 dark', 'x4 h2 seams', 'roof x4', 'belly x4 grey', 'roof tri 1:1', 'roof tri 2:1'] },
  hullSlope: { name: 'Hull slope', group: G, at: 'edge', foot: [2, 1, 1], build: hullSlope, accepts: ACCEPTS.hullSlope,
    variants: ['up 1:1 x4', 'up 1:2 x4', 'up 2:1 x4', 'down 1:1 x4', 'down 1:2 x4', 'down 2:1 x4', 'up 1:1 x4 ystripe', 'up 2:1 x4 glass', 'dslope up 1:1 plan 1:1', 'dslope down 1:1 plan 1:1'] },
  hullAngle: { name: 'Angled side', group: G, at: 'edge', foot: [1, 1, 1], build: hullAngle, accepts: ACCEPTS.hullAngle,
    variants: ['1:1 h1', '1:2 h1', '2:1 h1', '1:1 h2 ystripe', '1:1 h1 L'] },
  hullCorner: { name: 'Hull corner', group: G, at: 'point', foot: [1, 1, 1], build: hullCorner, accepts: ACCEPTS.hullCorner,
    variants: ['hip up 1:1', 'hip up 2:1', 'hip up 1:2', 'hip up 2:1/1:1', 'hip down 1:1', 'valley up 1:1', 'valley down 1:1', 'gable up 1:1', 'gable up 2:1', 'gable up 1:1 L', 'gable down 1:1'] },
  hullCap: { name: 'Nose and tail', group: G, at: 'edge', foot: [5, 4, 3], build: hullCap, accepts: ACCEPTS.hullCap,
    variants: ['nose sample canopy', 'nose sample blunt', 'nose sample wedge', 'tail sample flat', 'tail sample taper', 'nose medic canopy', 'nose explorer wedge', 'nose miner blunt', 'tail hauler flat mouth 9x5'] },
  hullOpening: { name: 'Hull opening', group: G, at: 'edge', foot: [2, 2.5, 0.5], build: hullOpening, accepts: ACCEPTS.hullOpening,
    variants: ['door', 'door x4', 'window x2', 'window x4', 'porthole', 'mouth 6x5', 'hatch 2', 'hatch 3'] },
};
