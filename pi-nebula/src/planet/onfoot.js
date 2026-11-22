// ON FOOT ON A PLANET (piece 3 of the rescue run, RESCUE_PLAN.md: "walking on the land is new"): the player's own walking
// as in the station (src/player.js: the shared keys and thumb stick, walked into walls and slid along them, up and down
// steps and ramps), on the planet's ground (src/walls.js given the ground: the land's own height, src/planet/land.js
// heightAt), and the station's camera behind them (src/chase.js), never under the ground. Solid: the stasis pods (as
// they stand, their lids as they are), the wreck's pieces (as they lie), the rocks a person would not step over, and the
// Medic set down (its hull and legs, its cabin, its ramp's treads once down: src/planet/medicdown.js). The pods, the
// wreck and the rocks are floors too, as furniture is in the station (walls.js: what is low enough is stepped onto,
// what is higher than a step and lower than a person's middle is walked round): a rock on a slope, felt only at a
// person's knees from uphill, was walked through.
//
//   const F = await makeOnFoot({ planet, scene, camera, lib, recipe, wreck, pods, medic })
//   F.walls (src/walls.js, the planet's), F.player (src/player.js), F.chase (src/chase.js)
//   F.put(feet, heading)       stand the player there (the nearest spot a person can stand), the camera behind them
//   F.update(dt, { move, run, look, zoom, others })   each frame: the player walks (move, run: the shared input's), the
//                              camera follows (look, zoom: the input's drag and wheel); others: more people to walk round
//   F.pods()                   the pods felt again as they now stand (a lid opened or shut)
//   F.stats { rocks, wallsMs }, F.dispose()
import * as THREE from 'three';
import { makeWalls } from '../walls.js';
import { makePlayer } from '../player.js';
import { makeChase } from '../chase.js';

// THE ROCKS felt: those whose top stands more than `step` metres over the ground under them (a pebble is walked over, a
// boulder walked round), within `near` metres of the player, felt again once they have gone `again` metres on; the
// camera kept `cam` metres over the ground; the near plane while on foot (the chase camera comes in close in the cabin)
export const ONFOOT = { step: 0.25, near: 36, again: 12, cam: 0.35, nearPlane: 0.08 };

const _m = new THREE.Matrix4(), _b = new THREE.Box3(), _v = new THREE.Vector3();
export async function makeOnFoot({ planet, scene, camera, lib, recipe, wreck = null, pods = null, medic = null }) {
  const t0 = performance.now(), land = planet.land, ground = (x, z) => land.heightAt(x, z);
  const walls = makeWalls({ zones: [], doors: [] }, { ground });
  // the wreck's pieces, as they lie (their triangles, src/planet/wreckship.js W.world)
  if (wreck && wreck.world) {
    const geos = wreck.world.map((w) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(w.tris, 3)); return g; });
    walls.add('wreck', { solid: geos, up: geos });
  }
  // the pods, as they stand on the ground (not as drawn: the drawing is lowered by the planet's curve)
  function podsIn() {
    if (!pods) return;
    const geos = [];
    for (const p of pods.pods) {
      p.group.updateMatrixWorld(true);
      const inv = p.group.matrixWorld.clone().invert();
      for (const m of p.meshes()) {
        if (/glass/.test(m.name)) continue;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', m.geometry.attributes.position.clone()); if (m.geometry.index) g.setIndex(m.geometry.index);
        g.applyMatrix4(_m.copy(p.place).multiply(inv).multiply(m.matrixWorld)); geos.push(g);
      }
    }
    walls.add('pods', { solid: geos, up: geos });
  }
  podsIn();
  if (medic) medic.addTo(walls);
  // the rocks near the player that stand taller than a step (the planet's own, as its cover lays them out round the
  // camera: src/planet/cover.js)
  let rocksAt = null; const stats = { rocks: 0, wallsMs: 0 };
  function rocksIn(at) {
    rocksAt = at.clone();
    const geos = [];
    for (const L of planet.cover.layers || []) {
      if (/plant/.test(L.name)) continue;
      for (const im of L.meshes) {
        if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, _m); _v.setFromMatrixPosition(_m);
          if (Math.hypot(_v.x - at.x, _v.z - at.z) > ONFOOT.near) continue;
          _b.copy(im.geometry.boundingBox).applyMatrix4(_m);
          if (_b.max.y - ground(_v.x, _v.z) < ONFOOT.step) continue;
          const g = new THREE.BufferGeometry(); g.setAttribute('position', im.geometry.attributes.position.clone()); if (im.geometry.index) g.setIndex(im.geometry.index);
          g.applyMatrix4(_m); geos.push(g);
        }
      }
    }
    stats.rocks = geos.length;
    if (geos.length) walls.add('rocks', { solid: geos, up: geos }); else walls.drop('rocks');
  }
  const player = await makePlayer({ lib, recipe, walls, scene });
  const chase = makeChase(camera, walls);
  const near0 = camera.near; camera.near = ONFOOT.nearPlane; camera.updateProjectionMatrix();
  stats.wallsMs = Math.round(performance.now() - t0);

  function put(feet, heading = 0) {
    const s = walls.snap(feet.x, feet.y + 0.5, feet.z, 2.5) || feet.clone();
    player.place(s, heading); chase.snap(player.pos, heading);
    player.c.update(0.5);      // (the standing clip faded all the way in: no first frame with the arms out)
    rocksIn(player.pos);
  }
  const _head = new THREE.Vector3();
  function update(dt, { move = null, run = false, look = null, zoom = 0, others = [] } = {}) {
    if (!rocksAt || Math.hypot(player.pos.x - rocksAt.x, player.pos.z - rocksAt.z) > ONFOOT.again) rocksIn(player.pos);
    player.update(dt, { move, run, yaw: chase.yaw, others });
    chase.update(dt, { feet: player.pos, heading: player.heading, speed: player.speed, look: look || { dx: 0, dy: 0 }, zoom });
    // (never under the ground: lifted over it, still looking at the head)
    const g = ground(camera.position.x, camera.position.z) + ONFOOT.cam;
    if (camera.position.y < g) { camera.position.y = g; camera.lookAt(_head.set(player.pos.x, player.pos.y + chase.eye, player.pos.z)); }
    camera.updateMatrixWorld();
    // (closer than that, the camera would be inside the head)
    player.c.root.visible = chase.near > 0.4;
  }
  return {
    walls, player, chase, stats, put, update, pods: podsIn,
    dispose() { player.dispose(); camera.near = near0; camera.updateProjectionMatrix(); for (const k of ['wreck', 'pods', 'rocks']) walls.drop(k); },
  };
}
