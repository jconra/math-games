// THE HAULER, WAITING OUTSIDE AT THE DOCK. The game's maker, HAUL-3 (2026-11-20): "Waiting outside at the dock, at
// the end of the bridge, as in the picture" (~/pw/space-math/shots/hauler-2/questions/q3_beside_the_dock.jpg: the
// Hauler at the far end of the docking bridge the dock's job builds, its crew door where the bridge's last ring meets
// it). So it waits out there, across the end of the bridge's line, its port side to the station:
//   - its crew door's middle on the bridge's middle line, the door's sill level with the bridge's deck;
//   - as near the bridge's end as it can come: its port side's outermost parts beside the door (the clamp frame's
//     posts and jaws, OUT below) stand where the stand-in ship's docking ring stood (kit/dockbridge.js moduleAt), the
//     same 0.28 m past the last ring's hoop. The door itself is in the hull between the front clamp frame and the cab,
//     1.05 m in from the frames' outer faces, so the bridge's last ring ends that far short of the door (a 2.6 m tube
//     cannot reach in between them);
//   - its nose along the station's side (to the south, toward the planet), as in his picture;
//   - legs up, its crew door and stair shut, its eight containers on and clamped, its pods at rest, the engines cold.
// It is drawn where the station's outside is (from the windows, from a ship flown out), and while the dock's job has the
// camera outside (in place of the stand-in ship: src/jobs/docklink.js, W.dockShip); not while a ship is out at the
// rocks (W.alone).
//
// ROUND 4 (the game's maker's answers, 2026-11-20):
//   - HAUL3-1, its containers: "I would just do it randomly": each a box or a tank, drawn when it is made here
//     (kit/ships/cargo-mix.js), once each time the game starts;
//   - HAUL3-2, the TUNNEL from the bridge's end in to the door ("Add a short, narrow tunnel, the size of the door ...";
//     "What is the point of having a tunnel if it isn't sealed?"): TUNNEL below, the numbers kit/dockbridge.js tunnel()
//     builds it from: the door's width, from the sill to the door's head, from the bridge's last hoop to the hull;
//   - HAUL3-3 and HAUL3-6, WALKED ACROSS AND INTO ("we need the bridge built before it is accessible ... I'd be fine with
//     it where you can get on it and look around after the bridge is built"): pose('docked'), its door lifted and its
//     stair laid on the tunnel's floor (kit/ships/hauler-built.js DOCKED); and inside(true), the ship with the rooms built
//     inside (the cockpit open to the cabin, the crew door's jambs only: the kit's LAB.cabin swap), for whoever goes in
//     (src/boarding.js builds the rooms themselves, src/dockwalk.js the bridge);
//   - HAUL3-4, A RING OF LIGHTS round the crew door: red, then green when the bridge reaches it: the kit's lamps
//     (hbDockLights), their lenses drawn here in a colour of their own, lights(colour).
// Not flown (HAUL3-6: "you don't fly it until you discover the other station and need to bring supplies to it").
//
// WHAT IT COSTS: its room file, the kit's Hauler with no rooms built inside (kit/rooms/ship-hauler-built.json, the
// cockpit for four behind its glass), built once a few seconds after the station is up (as the roof's small ships are:
// the start is no slower for it), every moving part posed once and held but its crew door and stair, so the whole ship is
// a handful of merged meshes and those two leaves, lit as the station's hull is (the sky's sun worked out in its
// materials, the sky in its metal: src/outside.js gives `light`) and by its own lamps baked in. The version with the
// rooms inside is built the first time someone comes to walk across (inside(true)) and kept.
//
//   const H = makeHaulerAtDock(W, { light })   light(material): the outside's sun and sky put in a material
//   H.group            in W.scene once built (null before)
//   H.ready            a promise: built and placed
//   H.matrix           the Hauler's own frame (kit/ships/hauler-built.js: nose +z, port +x, its ground y 0) to the
//                      station's, a Matrix4 (known at once, before it is built)
//   H.show(on)         drawn or not (src/outside.js, each frame)
//   H.box()            a plain box of its size as triangles in the station's frame: what a flown ship bumps into
//                      (src/flysolid.js, as the roof's small ships, src/roofjets.js jetBox)
//   H.pose(p)          'waiting' (its door and stair shut), 'docked' (DOCKED), or { crew, stair } (each a door's t)
//   H.lights(c, k)     its docking lights' colour: 'red', 'green' or [r, g, b], k times as bright
//   H.inside(on)       -> a promise: the version with the rooms inside drawn (built the first time), or the plain one
//   H.walls()          what a person walking aboard bumps into and stands on, of the ship as drawn now, in the
//                      station's frame: { solid: [geometry], up: [geometry] } (its hull, cockpit and door section, not
//                      its containers, frames or pods; the stair as it lies)
//   H.tunnel           TUNNEL; H.stats { tris, draws, ms, bakeMs } once built (and `inside` once that is)
import * as THREE from 'three';
import { loadRoom, buildRoom, forgetPiece, setDoors } from '../kit/layout.js';
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
// THE TUNNEL from the bridge's last hoop in to the crew door (kit/dockbridge.js tunnel), in the bridge's frame: inside,
// the door's own width and from its sill to its head (its floor 5 cm lower: the stair lies on it, its top at the sill);
// its walls 2.5 cm thick, so they stand clear of the front pod's back end (3.67 m along the ship) and of the lamps each
// side of the door; it ends against the door section's skin (kit/ships/hauler-built.js sideAt, its profile's bends)
const toBridgeY = (y) => y - HB.DECK + DOCK.deck, toShipY = (y) => y - DOCK.deck + HB.DECK;
export const TUNNEL = {
  half: (HB.CREWDOOR.z[1] - HB.CREWDOOR.z[0]) / 2, wall: 0.025,
  floor: DOCK.deck - 0.05, roof: toBridgeY(HB.CREWDOOR.head), z0: DOCK.z0 + DOCK.rings * DOCK.L,
  face: (y) => moduleAt() + OUT - HB.sideAt(toShipY(y)),
  ys: HB.SECT.slice(3, 13).map(([, y]) => toBridgeY(y)),
};
// what of the ship a person aboard can meet (its own frame): all but its containers, clamp frames, pods and legs
// (|x| under this: the door section's skin is 1.67 m out, the engine block's housing 1.71 m)
const BODY_X = 1.78;
const POSE = { waiting: { crew: 0, stair: 0 }, docked: HB.DOCKED };

export function makeHaulerAtDock(W, { light = () => {} } = {}) {
  // (the port faces away from the station: from its middle, the middle of all its rooms)
  const all = new THREE.Box3(); for (const z of W.built.zones) if (z.box && !z.box.isEmpty()) all.union(z.box);
  const frame = portFrame(W, all.getCenter(new THREE.Vector3()));
  const api = { group: null, matrix: null, stats: null, ready: null, shown: false, tunnel: TUNNEL, docked: HB.DOCKED, deck: HB.DECK, show() {}, box: () => null, pose() {}, lights() {}, inside: async () => false, walls: () => ({ solid: [], up: [] }), dispose() {} };
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
  let timer = null, room = null, mats = null, lensMat = null, lens = null, posed = POSE.waiting;
  const builds = { plain: null, cabin: null }, lit = new Set();
  // the ship built from its room file: every moving part held where it waits (legs up (1), the rest shut, on and at rest
  // (0)), but the crew door and its stair, which move; the docking lights' housings (their lenses are drawn below);
  // swap: the pieces that change with the rooms inside (the kit's LAB.cabin.swap)
  function make(swap = null) {
    const r = { ...room, pieces: room.pieces.map((pl) => {
      const variant = pl.piece === 'hbDockLights' ? 'port, housings' : swap?.[pl.piece]?.[pl.variant] || pl.variant;
      if (pl.piece === 'hbCrewDoor' || pl.piece === 'hbStair') return { ...pl, variant };
      return { ...pl, variant, hold: pl.piece === 'hbGear' ? 1 : 0 };
    }) };
    const B = buildRoom(r, mats, { bake: { voxel: 0.1, rays: 12 } });
    B.group.traverse((o) => { if (o.isMesh && o.material && !lit.has(o.material)) { lit.add(o.material); o.material.fog = false; light(o.material); } });
    setPose(B, posed);
    return B;
  }
  function setPose(B, p) { if (!B) return; for (const D of B.doors) { const t = D.piece === 'hbCrewDoor' ? p.crew : D.piece === 'hbStair' ? p.stair : null; if (t != null) setDoors([D], t); } }
  api.pose = (p) => { posed = typeof p === 'string' ? POSE[p] || POSE.waiting : { ...posed, ...p }; setPose(builds.plain, posed); setPose(builds.cabin, posed); };
  api.lights = (c = 'red', k = 1) => { const rgb = Array.isArray(c) ? c : HB.DOCK_LIGHTS[c] || HB.DOCK_LIGHTS.red; if (lensMat) lensMat.color.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k); api.lit = c; };
  api.ready = new Promise((done) => {
    timer = setTimeout(async () => {
      try {
        const t0 = performance.now();
        room = await loadRoom(new URL('../kit/rooms/ship-hauler-built.json', import.meta.url).href);
        // (its containers: a box or a tank each, at random, drawn now; any built before forgotten)
        api.mix = HB.drawMix(); forgetPiece('hbContainer');
        mats = HB.LAB.materials(makeMaterials(), DIRT);
        const B = builds.plain = make();
        const g = new THREE.Group(); g.name = 'the Hauler at the dock'; g.matrixAutoUpdate = false; g.matrix.copy(M);
        g.add(B.group);
        // (its docking lights' lenses, in a colour of their own: red while it waits for its bridge)
        lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
        lens = new THREE.Mesh(HB.dockLenses(), lensMat); lens.name = 'the Hauler: docking lights'; lens.matrixAutoUpdate = false; g.add(lens);
        api.lights(api.lit || 'red');
        g.visible = wantShown; W.scene.add(g); g.updateMatrixWorld(true);
        api.group = g;
        api.stats = { tris: B.stats.tris, draws: B.stats.draws + 1, ms: Math.round(performance.now() - t0), bakeMs: B.stats.bake.ms };
        // (the dock's job: the stand-in ship at the bridge's end is not drawn while the Hauler waits there)
        W.dockShip = api;
        done(api);
      } catch (e) { api.failed = true; console.warn('the Hauler did not come to the dock: ' + (e && e.message ? e.message : e)); done(null); }
    }, WAIT);
  });
  // THE ROOMS INSIDE (src/boarding.js, while someone may go in): the version of the ship that has them, drawn instead
  api.inside = async (on) => {
    if (!api.group) return false;
    if (on && !builds.cabin) {
      const t0 = performance.now(), B = builds.cabin = make(HB.LAB.cabin.swap);
      api.group.add(B.group); B.group.updateMatrixWorld(true);
      api.stats.inside = { tris: B.stats.tris, draws: B.stats.draws, ms: Math.round(performance.now() - t0) };
    }
    if (builds.cabin) builds.cabin.group.visible = !!on;
    builds.plain.group.visible = !on || !builds.cabin;
    api.inRooms = !!on && !!builds.cabin;
    return api.inRooms;
  };
  // what a person aboard bumps into, of the ship as drawn now (its body: |x| under BODY_X), in the station's frame, its
  // door and stair as they stand docked (whatever the dock's job has them at just now)
  api.walls = () => {
    const B = api.inRooms ? builds.cabin : builds.plain; if (!B) return { solid: [], up: [] };
    setPose(B, POSE.docked);
    try { return wallsOf(B); } finally { setPose(B, posed); }
  };
  function wallsOf(B) {
    const solid = [], up = [], m = new THREE.Matrix4(), im = new THREE.Matrix4();
    const keep = (g, mat, list, all = false) => {
      const p = g.attributes.position, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.count, out = [], v = new THREE.Vector3();
      for (let t = 0; t < n; t += 3) {
        let ok = true; const tri = [];
        for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, ix ? ix[t + k] : t + k).applyMatrix4(mat); if (!all && Math.abs(v.x) > BODY_X) { ok = false; break; } tri.push(v.x, v.y, v.z); }
        if (ok) out.push(...tri);
      }
      if (!out.length) return;
      const w = new THREE.BufferGeometry(); w.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); w.applyMatrix4(M);
      for (const L of list) L.push(w);
    };
    for (const z of B.zones) for (const k of ['solid', 'floor', 'glass']) if (z.merged[k]) keep(z.merged[k], m.identity(), k === 'glass' ? [solid] : [solid, up]);
    // (the door and its stair as they stand, all of them: the stair laid down is the tunnel's floor, out past the hull)
    for (const D of B.doors) {
      if (D.piece !== 'hbCrewDoor' && D.piece !== 'hbStair') continue;
      for (const leaf of D.leaves) for (const mesh of leaf.meshes || []) { if (/glass|glow|decal/.test(mesh.name)) continue; mesh.getMatrixAt(leaf.index, im); keep(mesh.geometry, im, [solid, up], true); }
    }
    return { solid, up };
  }
  api.dispose = () => { if (timer) clearTimeout(timer); if (api.group) api.group.removeFromParent(); for (const B of Object.values(builds)) if (B) B.dispose(); if (lens) lens.geometry.dispose(); if (lensMat) lensMat.dispose(); if (mats) for (const m of new Set(Object.values(mats))) m.dispose?.(); if (W.dockShip === api) W.dockShip = null; };
  return api;
}
