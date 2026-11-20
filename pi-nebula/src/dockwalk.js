// THE BRIDGE TO THE HAULER, ONCE BUILT: IT STANDS, AND IS WALKED ACROSS. The game's maker, HAUL3-3 (2026-11-20): "Once
// all nine rings are built, walk across it and in through the crew door"; HAUL3-6: "we need the bridge built before it
// is accessible ... I'd be fine with it where you can get on it and look around after the bridge is built, but you don't
// fly it until you discover the other station and need to bring supplies to it ... It does have a dock, that is what
// the bridge is for." So:
//   - IT STANDS once the crew member playing has built a whole bridge (src/jobs/dock.js bridgeStands: kept with them as
//     their bridge is, so it is there again after the page is loaded again) and the Hauler has come to the dock
//     (src/haulerdock.js);
//   - it is drawn as the dock's job leaves it, every ring braced and lit (kit/dockbridge.js wholeBridge), with the plate
//     across its end and THE TUNNEL from there in to the Hauler's crew door (HAUL3-2: "Add a short, narrow tunnel, the
//     size of the door, from the bridge's end in to the door"; "What is the point of having a tunnel if it isn't
//     sealed?"); the Hauler docked at it: its door lifted, its stair laid on the tunnel's floor, its ring of docking
//     lights green (HAUL3-4);
//   - IT IS WALKED: its deck, the tunnel and the stair are floors, its glass, struts, the tunnel's walls and the plate are
//     walls (one part of where a person can walk, src/walls.js 'dock:bridge'); the airlock's outer door, which led
//     nowhere and stayed shut, opens for whoever comes to it;
//   - THE HAULER'S ROOMS INSIDE (his deck plan's) are built and walked as the parked ships' are, by the same code
//     (src/boarding.js, its line 'hauler'; the hooks below): built when someone is in the airlock or out on the bridge,
//     dropped a few seconds after they have gone back in;
//   - while the dock's job is up it draws its own bridge and has the Hauler as it needs it (hold); not drawn while a ship
//     is out at the rocks (W.alone). The Hauler is not flown: nothing here moves it.
//
//   const D = makeDockWalk({ W, walls, crew })    crew: () -> the crew member playing (or null)
//   D.update(dt)       once a frame, before the boarding
//   D.on               the bridge stands and can be walked
//   D.hold(on)         the dock's job is up, drawing its own bridge (src/jobs/docklink.js)
//   D.boarding         the hooks the boarding uses for the Hauler (src/boarding.js SHIPS 'hauler' `dock`)
//   D.spots()          for the rigs: points along the way in, in the station's frame (null until it stands)
//   D.stats            { tris, draws, ms, walls } once made
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterials } from '../kit/materials.js';
import { DOCK, wholeBridge, meshesOf } from '../kit/dockbridge.js';
import { portFrame, bridgeLight, tunnelMeshes, GLASS } from './jobs/docklink.js';
import { bridgeStands } from './jobs/dock.js';

// where a person can walk on it: voxels as fine as a ship's cabin's (the tunnel is the door's width), and a person a
// little slimmer than in the station (half width, m; the station's 0.28, a cabin's 0.15)
export const WALK = { voxel: 0.05, r: 0.2 };
// (the box its walls are felt in, in the bridge's frame: across, up, out: from 6 m back inside the airlock to past the
// Hauler's far side)
export const WALK_BOX = [[-3, 3], [-0.5, 4.5], [-6, 15]];
// the hoops' line of light once built (the dock's job's, locked: src/jobs/docklink.js)
const HOOP = [0.35 * 0.9, 0.85 * 0.9, 1.4 * 0.9];

export function makeDockWalk({ W, walls, crew = () => null }) {
  const api = { on: false, held: false, stats: null, made: null };
  const H = () => W.dockShip;
  let frame = null, door = null, entry = null;
  // the outer port, found as the Hauler finds it (from the middle of all the rooms), and the airlock's outer door
  function find() {
    const all = new THREE.Box3(); for (const z of W.built.zones) if (z.box && !z.box.isEmpty()) all.union(z.box);
    frame = portFrame(W, all.getCenter(new THREE.Vector3()));
    door = W.built.doors.find((D) => D.piece === 'airlock' && D.variant === 'outer') || null;
    entry = door ? walls.doors.find((d) => d.D === door) || null : null;
  }
  // THE BRIDGE AS BUILT, made the first time it stands (kept)
  function make() {
    const t0 = performance.now(), mats = makeMaterials(), T = H().tunnel;
    for (const m of Object.values(mats)) m.fog = false;
    const light = bridgeLight(frame, { module: false });
    const root = new THREE.Group(); root.name = 'dock: the bridge, built'; root.matrixAutoUpdate = false; root.matrix.copy(frame);
    const B = wholeBridge();
    for (const o of meshesOf(B.solid, mats, light)) root.add(o);
    const glassMat = new THREE.MeshBasicMaterial({ color: GLASS.color, transparent: true, opacity: GLASS.full, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const glass = new THREE.Mesh(mergeGeometries(B.glass), glassMat); glass.name = 'dock bridge: glass'; glass.renderOrder = 2; root.add(glass);
    const hoopMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...HOOP), toneMapped: false, fog: false });
    const hoops = new THREE.Mesh(mergeGeometries(B.glow), hoopMat); hoops.name = 'dock bridge: hoops'; root.add(hoops);
    const stripMat = mats.glow.clone(); stripMat.color.setRGB(1, 1, 1);
    for (const o of meshesOf(B.strips, { glow: stripMat }, light)) root.add(o);
    const tn = tunnelMeshes(T, mats, frame); root.add(tn.group);
    root.visible = false; W.scene.add(root); root.updateMatrixWorld(true);
    // where a person can walk: all of it, in the station's frame (the glass a wall; the hoops' and strips' lines left out)
    const solid = [], up = [];
    let tris = 0, draws = 0;
    root.traverse((o) => {
      if (!o.isMesh) return; draws++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      if (o === hoops || o.material === stripMat) return;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', o.geometry.attributes.position.clone()); if (o.geometry.index) g.setIndex(o.geometry.index.clone());
      g.applyMatrix4(o.matrixWorld); solid.push(g); if (o !== glass) up.push(g);
    });
    // (its voxels' box: from inside the airlock to the far side of the Hauler's rooms, so the follow camera feels the
    // bridge's and the tunnel's walls from a head in either; WALK_BOX, in the bridge's frame)
    const box = new THREE.Box3(); for (let i = 0; i < 8; i++) box.expandByPoint(new THREE.Vector3(WALK_BOX[0][i & 1], WALK_BOX[1][(i >> 1) & 1], WALK_BOX[2][(i >> 2) & 1]).applyMatrix4(frame));
    api.made = { root, mats, glassMat, hoopMat, stripMat, solid, up, box, tunnel: tn };
    api.stats = { tris: Math.round(tris), draws, ms: Math.round(performance.now() - t0) };
  }
  // stood up, or taken down (the crew member playing changed): its walls, the outer door, the Hauler docked or waiting
  function set(on) {
    api.on = on;
    if (on) { const t = performance.now(), L = walls.add('dock:bridge', { solid: api.made.solid, up: api.made.up, voxel: WALK.voxel, r: WALK.r, box: api.made.box }); api.stats.walls = { ms: Math.round(performance.now() - t), voxelsMs: L.ms }; }
    else walls.drop('dock:bridge');
    if (door && entry) { entry.locked = !on; if (on) W.keepShut.delete(door); else W.keepShut.add(door); }
    hauler();
  }
  // (the Hauler as the bridge has it, unless the dock's job has it just now)
  function hauler() { const h = H(); if (!h?.pose || api.held) return; h.pose(api.on ? 'docked' : 'waiting'); h.lights(api.on ? 'green' : 'red'); }
  api.hold = (on) => { api.held = !!on; if (!on) hauler(); if (api.made) api.made.root.visible = api.on && !api.held && !W.alone; };
  api.update = () => {
    if (!frame && W.built) find();
    const h = H(), want = !!(frame && h?.group && h.pose && bridgeStands(crew()));
    if (want && !api.made) make();
    if (want !== api.on) set(want);
    if (api.made) api.made.root.visible = api.on && !api.held && !W.alone;
  };
  // THE HAULER, BOARDED (src/boarding.js): may it be gone into, is it drawn, where it is, its rooms' version of the
  // ship, what of its hull a person meets
  api.boarding = {
    open: () => api.on,
    shown: () => !!H()?.group?.visible,
    matrix: () => H().matrix,
    deck: () => H().deck,
    inside: (on) => (H() ? H().inside(on) : Promise.resolve(false)),
    walls: () => (H() ? H().walls() : { solid: [], up: [] }),
  };
  // (for the rigs: on the floor at the port's sill, on the bridge's deck at its middle and at its end, in the tunnel,
  // on the stair in the Hauler's doorway, and in its crew area just inside)
  api.spots = () => {
    if (!api.on || !frame) return null;
    const T = H().tunnel, at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(frame).toArray().map((v) => +v.toFixed(3));
    const zf = T.face(DOCK.c);
    return { port: at(0, DOCK.deck, -0.6), sill: at(0, DOCK.deck, 0.15), deck: at(0, DOCK.deck, DOCK.z0 + DOCK.rings * DOCK.L / 2), end: at(0, DOCK.deck, T.z0 - 0.4), tunnel: at(0, DOCK.deck, (T.z0 + zf) / 2), door: at(0, DOCK.deck, zf + 0.15), inside: at(0, DOCK.deck, zf + 1.3) };
  };
  return api;
}
