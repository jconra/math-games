// A SHIP'S CABIN AS A ROOM: the rooms built inside a ship from one of its blueprints (cabin-built.js buildCabin), put
// through the kit's own layout code (kit/layout.js buildRoom) so its sliding doors, lights and baked light work as a
// station room's do. The Ship Lab (labs/ships/main.js) and the game (src/boarding.js) both build their cabins here.
//
//   const C = buildCabinRoom(bp, { space, outer, look, level, mats, bake, saved })
//     bp      the blueprint (kit/ships/<id>.blueprint.json)
//     space   the ship's measured space (assets/ships/<shell>.space.json): its deck height and where the hull comes down
//     outer   the ship's own door as the cabin meets it (the ship module's LAB.cabin.outer)
//     look, level   the cabin's look and its light level (cabin-built.js LOOKS, LEVELS)
//     mats    the materials (cabin-built.js cabinMaterials(look, level))
//     bake    the light's bake (CABIN_BAKE); saved: a saved bake (kit/bakefile.js), used where it still matches
//   C.built   the kit's built room, in the ship's own frame (nose +z, port +x, the landing feet on y 0): two zones,
//             'walls' (everything but the ceilings) and 'ceilings'; its doors the cabin's sliding doors
//   C.parts   what the cabin kit says of itself: stats, runs (the lab's), seesOutside, pools (the pools of real-time
//             light by room), beams (the beams of dusty light under the ceilings' discs, deck at 0), lightList
//   C.ms      how long it took to build (ms)
import { buildRoom, forgetPiece } from '../layout.js';
import { PIECES } from '../catalog.js';
import { buildCabin } from './cabin-built.js';

// (baked without shadows: on the bake's 8 cm grid a 45-degree slope fills its cells in steps thick enough that its own
// points start inside them, so it shadows itself from every light; the corner darkening stays)
export const CABIN_BAKE = { voxel: 0.08, rays: 24, shadows: false };

let seq = 0;
export function buildCabinRoom(bp, { space, outer = {}, look = 'light', level = null, mats, bake = CABIN_BAKE, saved = null } = {}) {
  const t0 = performance.now(), id = 'cabin' + (++seq), parts = {};
  // (a piece made for this one build: drawn, merged into the room, then forgotten)
  PIECES[id] = {
    name: 'Cabin: ' + (bp.name || bp.id), group: 'Ships', at: 'free', variants: ['walls', 'ceilings'], foot: [5, 2.5, 10],
    build: (p, v) => {
      buildCabin(p, bp, { space, which: v, outer, look, level });
      Object.assign(parts, p.stats); if (p.runs?.length) parts.runs = p.runs; parts.seesOutside = p.seesOutside;
      parts.pools = [...(parts.pools || []), ...(p.pools || [])]; parts.beams = [...(parts.beams || []), ...(p.beams || [])]; parts.lightList = [...(parts.lightList || []), ...(p.lightList || [])];
    },
  };
  const room = { name: 'cabin', grid: { cell: 0.5, step: 0.5, deck: space.deck }, rooms: ['walls', 'ceilings'].map((v) => ({ id: v, pieces: [{ piece: id, cell: [0, 0], turn: 0, level: 0, variant: v }] })) };
  let built;
  try { built = buildRoom(room, mats, { bake, saved }); } finally { delete PIECES[id]; forgetPiece(id); }
  return { built, parts, room, ms: Math.round(performance.now() - t0) };
}
