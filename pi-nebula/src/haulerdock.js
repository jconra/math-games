// THE HAULER, WAITING OUTSIDE AT THE DOCK. The game's maker, HAUL-3 (2026-11-20): "Waiting outside at the dock, at
// the end of the bridge, as in the picture" (~/pw/space-math/shots/hauler-2/questions/q3_beside_the_dock.jpg: the
// Hauler at the far end of the docking bridge the dock's job builds, its crew door where the bridge's last ring meets
// it). So it waits out there, across the end of the bridge's line, its port side to the station:
//   - its crew door's middle on the bridge's middle line, the door's sill level with the bridge's deck;
//   - as near the bridge's end as it can come: its port side's outermost parts beside the door (the clamp frame's
//     posts and jaws, OUT below) stand where the stand-in ship's docking ring stood (kit/dockbridge.js moduleAt), the
//     same 0.28 m past the last ring's hoop. The door itself is in the hull between the front clamp frame and the cab,
//     1.05 m in from the frames' outer faces, so the bridge's last ring ends that far short of the door (a 2.6 m tube
//     cannot reach in between them): a question for him;
//   - its nose along the station's side (to the south, toward the planet), as in his picture;
//   - legs up, its crew door and stair shut, its eight containers on and clamped, its pods at rest, the engines cold.
// It is drawn where the station's outside is (from the windows, from a ship flown out), and while the dock's job has the
// camera outside (in place of the stand-in ship: src/jobs/docklink.js, W.dockShip); not while a ship is out at the
// rocks (W.alone). Nobody walks across to it or boards it (the bridge is drawn only by the dock's job, and only to be
// looked at): a question for him.
//
// WHAT IT COSTS: its room file, the kit's Hauler with no rooms built inside (kit/rooms/ship-hauler-built.json, the
// cockpit for four behind its glass), built once a few seconds after the station is up (as the roof's small ships are:
// the start is no slower for it), every moving part posed once and held, so the whole ship is a handful of merged meshes
// (no instanced leaves), lit as the station's hull is (the sky's sun worked out in its materials, the sky in its metal:
// src/outside.js gives `light`) and by its own lamps baked in.
//
//   const H = makeHaulerAtDock(W, { light })   light(material): the outside's sun and sky put in a material
//   H.group            in W.scene once built (null before)
//   H.ready            a promise: built and placed
//   H.matrix           the Hauler's own frame (kit/ships/hauler-built.js: nose +z, port +x, its ground y 0) to the
//                      station's, a Matrix4 (known at once, before it is built)
//   H.show(on)         drawn or not (src/outside.js, each frame)
//   H.box()            a plain box of its size as triangles in the station's frame: what a flown ship bumps into
//                      (src/flysolid.js, as the roof's small ships, src/roofjets.js jetBox)
//   H.stats            { tris, draws, ms, bakeMs } once built
import * as THREE from 'three';
import { loadRoom, buildRoom } from '../kit/layout.js';
import { makeMaterials } from '../kit/materials.js';
import * as HB from '../kit/ships/hauler-built.js';
import { DOCK, moduleAt } from '../kit/dockbridge.js';
import { portFrame } from './jobs/docklink.js';

// how long after the outside is made it is built (ms), and its grime (the Ship Lab's "Some")
export const WAIT = 3000, DIRT = 0.45;
// its port side's outermost point near the door: the clamp frames' posts with their jaws' pins (hauler-built.js FRAME,
// JAW: the pin 3 cm round the post's outer corner); the containers (to 2.52 m) and the front pods (to 2.56 m) stand in
// from it. Checked against the built ship by ~/pw/space-math/rigs/hauler-3/steps_dockcheck.js
export const OUT = HB.FRAME.post[1] + 0.03;
// the door's middle along the ship (z) and the ship's frame to the bridge's (kit/dockbridge.js: +z out from the port,
// y up from the station's floor, x across): turned a quarter round so its port side faces back along the bridge
export const DOOR_Z = (HB.CREWDOOR.z[0] + HB.CREWDOOR.z[1]) / 2;
export function inBridge() {
  const R = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  // (a point of the ship (x, y, z) goes to (z - DOOR_Z, y + deck - DECK, moduleAt + OUT - x))
  return new THREE.Matrix4().makeTranslation(-DOOR_Z, DOCK.deck - HB.DECK, moduleAt() + OUT).multiply(R);
}
// its size as it waits (its own frame): the frames and pods across, the keel's bump to the antennas' tips, nose to
// the drums' rims (legs up)
export const SIZE = { x: [-2.75, 2.75], y: [0.4, 4.4], z: [-8.05, 8.0] };

export function makeHaulerAtDock(W, { light = () => {} } = {}) {
  // (the port faces away from the station: from its middle, the middle of all its rooms)
  const all = new THREE.Box3(); for (const z of W.built.zones) if (z.box && !z.box.isEmpty()) all.union(z.box);
  const frame = portFrame(W, all.getCenter(new THREE.Vector3()));
  const api = { group: null, matrix: null, stats: null, ready: null, shown: false, show() {}, box: () => null, dispose() {} };
  if (!frame) { console.warn('the Hauler: the station has no outer docking port to wait at'); api.ready = Promise.resolve(null); return api; }
  const M = api.matrix = frame.clone().multiply(inBridge());
  let wantShown = true;
  api.show = (on) => { wantShown = !!on; if (api.group) api.group.visible = wantShown; };
  api.box = () => {
    const position = new Float32Array(24), v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(SIZE.x[i & 1 ? 1 : 0], SIZE.y[i & 2 ? 1 : 0], SIZE.z[i & 4 ? 1 : 0]).applyMatrix4(M);
      position.set([v.x, v.y, v.z], i * 3);
    }
    return { position, index: new Uint32Array([0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5]) };
  };
  let timer = null, built = null, mats = null;
  api.ready = new Promise((done) => {
    timer = setTimeout(async () => {
      try {
        const t0 = performance.now();
        const room = await loadRoom(new URL('../kit/rooms/ship-hauler-built.json', import.meta.url).href);
        // (every moving part held where it waits: legs up (1), the rest shut, on and at rest (0))
        room.pieces = room.pieces.map((pl) => ({ ...pl, hold: pl.piece === 'hbGear' ? 1 : 0 }));
        mats = HB.LAB.materials(makeMaterials(), DIRT);
        built = buildRoom(room, mats, { bake: { voxel: 0.1, rays: 12 } });
        const seen = new Set();
        built.group.traverse((o) => { if (o.isMesh && o.material && !seen.has(o.material)) { seen.add(o.material); o.material.fog = false; light(o.material); } });
        const g = new THREE.Group(); g.name = 'the Hauler at the dock'; g.matrixAutoUpdate = false; g.matrix.copy(M);
        g.add(built.group); g.visible = wantShown; W.scene.add(g); g.updateMatrixWorld(true);
        api.group = g;
        api.stats = { tris: built.stats.tris, draws: built.stats.draws, ms: Math.round(performance.now() - t0), bakeMs: built.stats.bake.ms };
        // (the dock's job: the stand-in ship at the bridge's end is not drawn while the Hauler waits there)
        W.dockShip = api;
        done(api);
      } catch (e) { api.failed = true; console.warn('the Hauler did not come to the dock: ' + (e && e.message ? e.message : e)); done(null); }
    }, WAIT);
  });
  api.dispose = () => { if (timer) clearTimeout(timer); if (api.group) api.group.removeFromParent(); if (built) built.dispose(); if (mats) for (const m of new Set(Object.values(mats))) m.dispose?.(); if (W.dockShip === api) W.dockShip = null; };
  return api;
}
