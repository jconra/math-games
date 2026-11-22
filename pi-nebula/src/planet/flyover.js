// THE MEDIC FLOWN OVER A PLANET, TO SET DOWN BESIDE THE WRECK: the game's own flying (src/flying.js, the same keys,
// sticks, buttons, help corner and dashboard as at the station: one ship piece for all ships) given the planet as a
// body of its own, as the rocks are (src/fieldfly.js): the Medic drawn there (its own kit, kit/ships/medic-built.js, as
// the Ship Lab builds it), the ground as what it bumps into, the level ground beside the wreck as its pad and floor,
// the autopilot's way down onto it (src/planet/landing.js). The game's maker, MED-3: "the pilot sets the Medic down
// beside them, by hand or by autopilot, with the landing guide, as in the hangar".
//
//   const FO = await flyOver({ renderer, scene, camera, land, toward, at, ahead, onGetUp, far })
//     at: where the ship comes in [x, y, z]; ahead: the way its nose points [x, z]; toward: the pods' middle [x, z]
//     (the ramps' side faces them); onGetUp(): down where the seat lets the pilot out, the seat's prompt pressed
//   FO.update(dt), FO.aim(camera, dt)   each frame (the flying has the camera while it is flown)
//   FO.F (the flying), FO.cfg, FO.nose() the ship's nose's way [x, z] (for the radar), FO.close()
import * as THREE from 'three';
import { startFlying } from '../flying.js';
import { flightOf } from '../fleet.js';
import { turn } from '../flymodel.js';
import { planetPad, groundSolid, planDown } from './landing.js';

const KIT = new URL('../../kit/', import.meta.url).href;
// the ship's kit frame (x to port, y up, z to its nose) in the flight model's own [ahead, up, right]
const KIT_FRAME = new THREE.Matrix4().makeRotationY(Math.PI / 2);
// the corners' darkness baked as the wreck's is (coarser than the Ship Lab's), its grime the kit's "Some"
export const MEDIC_LOOK = { bake: { voxel: 0.12, rays: 12 }, dirt: 'Some' };

// THE MEDIC, built once by its own kit and kept (each flight puts it in the scene and takes it out again)
let built = null;
function buildMedic() {
  if (!built) built = (async () => {
    const [L, MT, MD] = await Promise.all([import(KIT + 'layout.js'), import(KIT + 'materials.js'), import(KIT + 'ships/medic-built.js')]);
    const room = await L.loadRoom(KIT + 'rooms/ship-medic-built.json');
    const B = L.buildRoom(room, MD.LAB.materials(MT.makeMaterials(), MD.LAB.dirt[MEDIC_LOOK.dirt]), { bake: MEDIC_LOOK.bake });
    // (its legs down, its ramps and its crew door shut: as it flies)
    MD.LAB.pose(B, { gear: 0, ramp: 0, rampS: 0, crew: 0 }, { updateDoors: L.updateDoors });
    B.group.matrixAutoUpdate = false; B.group.name = 'the Medic, flown';
    return B;
  })().catch((e) => { built = null; throw e; });
  return built;
}

export async function flyOver({ renderer, scene, camera, land, toward = null, at, ahead = [0, -1], onGetUp = null, far = 20000 }) {
  const cfg = planetPad(flightOf('medic'), land, { toward });
  const B = await buildMedic();
  scene.add(B.group);
  const F = startFlying({ W: { renderer, scene, camera }, boarding: null, crane: null }, {
    cfg, goal: 'land', pilot: true, view: 'behind', ...(onGetUp ? { onGetUp } : {}),
    body: { at: new THREE.Matrix4(), M0: KIT_FRAME, p: at, f: [ahead[0], 0, ahead[1]], solid: groundSolid(land, cfg), plan: (S) => planDown(S, land), far,
      fly: (M) => { B.group.matrix.copy(M); B.group.matrixWorldNeedsUpdate = true; } },
  });
  let closed = false;
  return {
    F, cfg, ship: B.group,
    update(dt) { if (!closed) F.update(dt); },
    aim(cam, dt) { if (!closed) F.aim(cam, dt); },
    nose() { const f = turn(F.S.q, [1, 0, 0]); return [f[0], f[2]]; },
    close() { if (closed) return; closed = true; F.close(); scene.remove(B.group); },
  };
}
