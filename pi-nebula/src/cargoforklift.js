// HIS FORKLIFT IN CARGO, IN THE GAME (kit/places-plan.js FORKLIFT has the game's maker's words and its place; the
// drawing is kit/forklift.js). Parked in its painted place by the shipping desk, it stands in the walls as the room's
// other furniture does: the player and Cargo's people walk round it (src/walls.js, a part added later).
//   const forklift = makeCargoForklift({ W, walls })
//   forklift.update(soon, { camera, feet })   once a frame (feet: () => [Vector3], the player's and Cargo's people's,
//                         asked only until it stands). soon: the player is in the lift. The file is fetched the
//                         first time that is so (as Cargo's people are made then: src/people.js THE PLACES ONLY THE LIFT
//                         GOES TO), never at the game's start; the ride down hides the wait.
//   forklift.state()      { asked, fetched, standing, warmed (drawn once, unseen), ms, facts, wallsKB, error } for the rigs
// PUT IN where nobody sees it come: while Cargo is not drawn (the lift's doors are shut on the way down), or else
// while its place is out of the camera's view; and never onto someone standing there (a slow phone's player could be
// down there before the file is). Once in, it stays.
import * as THREE from 'three';
import { loadForklift, standForklift } from '../kit/forklift.js';
import { STORE, forkliftBox } from '../kit/places-plan.js';

const KEY = 'cargo:forklift';
// its shine: the room's own picture of itself, this much (the kit's painted parts have 1.25: kit/materials.js, as the
// station sets them)
const SHINE = 1.25;

export function makeCargoForklift({ W, walls }) {
  const zone = W.room('store');
  const [x0, x1, z0, z1] = forkliftBox();
  const box = new THREE.Box3(new THREE.Vector3(x0, STORE.floor, z0), new THREE.Vector3(x1, STORE.floor + 2.3, z1));
  const _f = new THREE.Frustum(), _m = new THREE.Matrix4();
  const S = { asked: false, fetched: false, standing: false, warmed: false, ms: {}, facts: null, wallsKB: 0, error: null };
  let F = null, made = null, t0 = 0;
  function seen(camera) {
    if (!zone.group.visible || !camera) return false;
    camera.updateMatrixWorld(); _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m);
    return _f.intersectsBox(box);
  }
  const inTheWay = (feet) => feet.some((p) => p && p.y > STORE.floor - 1 && p.y < STORE.floor + 1 && p.x > x0 - 0.4 && p.x < x1 + 0.4 && p.z > z0 - 0.4 && p.z < z1 + 0.4);
  function put() {
    const t = performance.now();
    made = standForklift(F);
    zone.group.add(made.group); made.group.updateMatrixWorld(true);
    made.light(W.envAt(new THREE.Vector3((x0 + x1) / 2, STORE.floor + 1, (z0 + z1) / 2)), SHINE);
    const L = walls.add(KEY, { solid: made.solid });
    S.standing = true; S.ms.put = Math.round(performance.now() - t); S.ms.walls = L.ms; S.ms.fromAsked = Math.round(performance.now() - t0);
    S.wallsKB = L.V ? Math.round(L.V.bytes / 1024) : 0;
  }
  // ITS FIRST DRAWING, where nobody sees it: the first frame Cargo is drawn after it stands (on the ride down, the
  // doors shut, the view still), it is drawn whether in front of the camera or not, so its program is made and its
  // picture sent to the graphics card then, not in the frame the player first turns to it (that frame took 46 ms on
  // the desktop where the frames round it took 6). (warm: 0 not yet, 1 drawn this frame, 2 done)
  let warm = 0;
  const culled = (on) => made.group.traverse((o) => { if (o.isMesh) o.frustumCulled = on; });
  function warmUp() {
    if (warm === 1) { culled(true); warm = 2; S.warmed = true; } else if (zone.group.visible) { culled(false); warm = 1; }
  }
  return {
    update(soon, { camera = null, feet = () => [] } = {}) {
      if (!zone) return;
      if (made) { if (warm < 2) warmUp(); return; }
      if (soon && !S.asked) {
        S.asked = true; t0 = performance.now();
        loadForklift().then((f) => { F = f; S.fetched = true; S.facts = f.facts; S.ms.fetched = Math.round(performance.now() - t0); })
          .catch((e) => { S.error = (e && e.message) || String(e); console.warn('cargo: the forklift did not come: ' + S.error); });
      }
      if (F && !seen(camera) && !inTheWay(feet())) put();
    },
    state: () => ({ ...S, ms: { ...S.ms } }),
  };
}
