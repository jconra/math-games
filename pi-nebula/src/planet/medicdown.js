// THE MEDIC SET DOWN ON A PLANET, BESIDE THE WRECK, ITS RAMP DOWN (piece 3 of the rescue run, RESCUE_PLAN.md: "Down the
// ramp. You get up, walk back and down the Medic's ramp onto the ground"). Placed as landed (another piece flies it
// down: where it stands is given). The game's own Medic: its hull built by the kit's own layout code from its own room
// file (kit/rooms/ship-medic-built.json, kit/ships/medic-built.js, the pieces that change with a cabin inside swapped as
// the Ship Lab and the station swap them, its LAB.cabin.swap), and its cabin the game's own (kit/ships/cabin-room.js,
// from the blueprint the game's maker picked, as src/boarding.js builds it). Nothing of either is copied or changed.
//
//   const M = await makeMedicDown({ scene, renderer, camera, ground, sky, stand, quality })
//       stand: { x, y, z, yaw, side } (src/rescueplan.js medicStand: its middle on the ground, its nose's turn, which
//       ramp comes down: 'port' or 'starboard'); ground, sky: the planet's (src/planet/planet.js: its ground's shared
//       settings, its cloud sky if it has air), so its hull is lit as the planet's own things are
//   M.group, M.M (its own frame in the world: x to port, y up from its ground line, z to the nose), M.inv, M.stand
//   M.addTo(walls)          what a person meets of it, added to where a person can walk (src/walls.js): its hull (its
//                           legs, its shut doors), its cabin (finer, a person slimmer in it, as boarding.js has it), and
//                           its ramp's treads once it is down; each made in its own frame and stood where it is (walls.place)
//   M.update(dt, camera, eyes)   each frame: the planet's curve where it stands, the ramp, the cabin's sliding doors for
//                           whoever is nearest each (eyes: feet in the world), its screens' clock
//   M.ramp(k)               its ramp on its way down (1) or up (0); M.rampT (0 up .. 1 down)
//   M.foot                  a Vector3: on the ground just past its ramp's foot, in the middle of the ramp (the way in)
//   M.bp, M.space, M.places (src/aboard.js's: every seat and bed of its rooms), M.beds (src/rescueplan.js patientBeds),
//   M.inside(p)             is a point (the world) inside its cabin's rooms
//   M.stats { ms, hullMs, cabinMs, tris, draws }, M.dispose()
import * as THREE from 'three';
import { loadRoom, buildRoom, updateDoors, setDoors } from '../../kit/layout.js';
import { makeMaterials, U as KIT_U } from '../../kit/materials.js';
import * as MD from '../../kit/ships/medic-built.js';
import { cabinMaterials } from '../../kit/ships/cabin-built.js';
import { buildCabinRoom } from '../../kit/ships/cabin-room.js';
import { liveTick, livePalette } from '../../kit/shipparts/cabin/live.js';
import { makeBeams } from '../../kit/beams.js';
import { onPlanet } from './podsdraw.js';
import { placesOf } from '../aboardplan.js';
import { MEDIC, patientBeds } from '../rescueplan.js';

const KIT = new URL('../../kit/', import.meta.url).href;
// the hull's corners' darkness baked coarser than the Ship Lab's (it is made each time a planet is landed on: as the
// wreck's, src/planet/wreckship.js WRECK_BAKE)
export const MEDIC_BAKE = { voxel: 0.12, rays: 12 };
// INSIDE, THE STATION'S LIGHT: the cabin is lit by its own strips (its baked light) and, as in the station's hangar, the
// station's soft fill (src/station.js: 0xdde2e8 over 0x5d6065, 0.75); the planet's sun is kept off it (nothing casts a
// shadow here: it would light the cabin through the hull)
export const INSIDE_FILL = { sky: 0xdde2e8, ground: 0x5d6065, power: 0.75 };

const ONE = [null], FAR = new THREE.Vector3(1e6, 1e6, 1e6);
const fetchJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error('the Medic: no file at ' + url); return r.json(); });
const breath = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));

// the cabin's materials: the planet's sun off, its sky's light the station's fill
function insideLight(mat, U) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_pars_begin>', '#include <lights_pars_begin>\nuniform vec3 uFillSky, uFillGround;\n#if NUM_HEMI_LIGHTS > 0\nHemisphereLight fillOf( HemisphereLight h ) { h.skyColor = uFillSky; h.groundColor = uFillGround; return h; }\n#endif')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= 0.0;')
        .replace(/getHemisphereLightIrradiance\( hemisphereLights\[ i \], /g, 'getHemisphereLightIrradiance( fillOf( hemisphereLights[ i ] ), '));
  };
  mat.customProgramCacheKey = () => prevKey() + '|medic-inside';
  return mat;
}
const eachMaterial = (mats, fn) => { const seen = new Set(); for (const m of Object.values(mats)) if (m && m.isMaterial && !seen.has(m)) { seen.add(m); fn(m); } };

export async function makeMedicDown({ scene, renderer = null, camera = null, ground, sky = null, stand, quality = 'medium' }) {
  const t0 = performance.now();
  const side = stand.side === 'starboard' ? 'starboard' : 'port', sideSign = side === 'port' ? 1 : -1;
  const M = new THREE.Matrix4().makeRotationY(stand.yaw).setPosition(stand.x, stand.y, stand.z), inv = M.clone().invert();
  const group = new THREE.Group(); group.name = 'planet:medic'; group.matrixAutoUpdate = false; group.matrix.copy(M);
  // ── its hull: the kit's own build, its cabin's pieces swapped in ─────────────────────────────────────────────────
  const [room, bp] = await Promise.all([loadRoom(KIT + 'rooms/ship-medic-built.json'), fetchJSON(KIT + 'ships/' + MEDIC.bp + '.blueprint.json')]);
  const space = await fetchJSON(new URL('../../assets/ships/' + bp.shell + '.space.json', import.meta.url).href);
  const swap = MD.LAB.cabin.swap;
  room.pieces = room.pieces.map((pl) => (swap[pl.piece]?.[pl.variant] ? { ...pl, variant: swap[pl.piece][pl.variant] } : pl));
  const hullMats = MD.grimeMaterials(makeMaterials());
  // (lit as the planet's own things are: the sun and the sky's light from the ground's light picture where it stands,
  // the haze: as the pods are, src/planet/podsdraw.js onPlanet)
  eachMaterial(hullMats, (m) => { if (m.isMeshStandardMaterial) onPlanet(m, { ground, sky, kind: 'medic-' + m.name }); });
  await breath();
  let t = performance.now();
  const B = buildRoom(room, hullMats, { bake: MEDIC_BAKE });
  const hullMs = Math.round(performance.now() - t);
  group.add(B.group);
  // the legs down (the build's own: its gear door shut is down), both ramps up, the starboard opening's cabinets away
  // (his blueprint has both ramps: "ramps": "both"), then this side's ramp down at once
  const rampOf = (s) => B.doors.find((D) => D.piece === 'mdRamp' && Math.sign(D.sense.x) === s);
  const ramp = rampOf(sideSign);
  MD.equipStep(B, false);
  if (ramp) { ONE[0] = ramp; setDoors(ONE, 1); }
  MD.rampFoot(B);
  await breath();
  // ── its cabin, as the game builds it ─────────────────────────────────────────────────────────────────────────────
  t = performance.now();
  const cabinMats = cabinMaterials('light'); livePalette(cabinMats.live, 'vivid');
  const fill = { uFillSky: { value: new THREE.Color(INSIDE_FILL.sky).multiplyScalar(INSIDE_FILL.power) }, uFillGround: { value: new THREE.Color(INSIDE_FILL.ground).multiplyScalar(INSIDE_FILL.power) } };
  eachMaterial(cabinMats, (m) => { if (m.isMeshStandardMaterial) insideLight(m, fill); });
  const C = buildCabinRoom(bp, { space, outer: MD.LAB.cabin.outer, look: 'light', mats: cabinMats });
  group.add(C.built.group);
  const beams = quality === 'low' ? null : makeBeams(C.parts.beams);
  if (beams) { beams.object.position.y = space.deck; group.add(beams.object); }
  const cabinMs = Math.round(performance.now() - t);
  scene.add(group);
  group.updateMatrixWorld(true);
  if (renderer && camera) { try { if (renderer.compileAsync) await renderer.compileAsync(group, camera); else renderer.compile(group, camera); } catch (e) { /* made on the first frame instead */ } }

  // ── what a person meets of it (each in its own frame, stood where it is: walls.place) ──────────────────────────
  const geoOf = (g) => { const w = new THREE.BufferGeometry(); w.setAttribute('position', g.attributes.position.clone()); if (g.index) w.setIndex(g.index); return w; };
  const boxOf = (D) => { const box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4(); for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); box.union(b.copy(im.geometry.boundingBox).applyMatrix4(m.copy(leaf.M).multiply(leaf.base))); } return box; };
  const hull = { solid: [], up: [], doors: [] }, cabin = { solid: [], up: [], doors: [] };
  for (const z of B.zones) for (const k of ['solid', 'floor', 'glass']) { const g = z.merged[k]; if (!g) continue; const w = geoOf(g); hull.solid.push(w); if (k !== 'glass') hull.up.push(w); }
  // (its doors as they stand now: the ramps (shut, standing in their openings, until fully down), the crew door (shut:
  // its stair is not climbed yet, BOARDING.md), its legs (a box round each, as the station's walls have them))
  const hullDoors = [];
  for (const D of B.doors) {
    if (!['mdRamp', 'mdCrewDoor', 'mdGear'].includes(D.piece)) continue;
    const box = boxOf(D); if (box.isEmpty()) continue;
    // (a ramp's box is the ramp standing up: taken while it is up, so the ramp down is never in its own way)
    if (D.piece === 'mdRamp' && D.t > 0) { const t0r = D.t; ONE[0] = D; setDoors(ONE, 0); box.copy(boxOf(D)); setDoors(ONE, t0r); MD.rampFoot(B); }
    hull.doors.push({ D, box }); hullDoors.push(D);
  }
  for (const z of C.built.zones) for (const k of ['solid', 'floor', 'glass']) { const g = z.merged[k]; if (!g) continue; const w = geoOf(g); cabin.solid.push(w); if (k !== 'glass') cabin.up.push(w); }
  for (const D of C.built.doors) { const box = boxOf(D); if (!box.isEmpty()) cabin.doors.push({ D, box }); }
  // (the ramp's treads, down: its leaves as they lie)
  const rampGeos = () => {
    const out = [], m = new THREE.Matrix4();
    if (!ramp) return out;
    for (const leaf of ramp.leaves) for (const im of leaf.meshes || []) {
      if (/glass|glow|decal/.test(im.name)) continue;
      im.getMatrixAt(leaf.index, m); const w = geoOf(im.geometry); w.applyMatrix4(m); out.push(w);
    }
    return out;
  };
  let walls = null;
  function addTo(W) {
    walls = W;
    W.add('medic:hull', { solid: hull.solid, up: hull.up, doors: hull.doors, at: M });
    // (its doors: the ramps passed through only once fully down, as boarding.js has it (WAY_OPEN); the crew door and
    // the legs never)
    for (const d of W.doors) if (d.part === 'medic:hull') { if (d.D.piece === 'mdRamp') d.open = MEDIC.wayOpen; else d.locked = true; }
    W.add('medic:cabin', { solid: cabin.solid, up: cabin.up, doors: cabin.doors, voxel: MEDIC.cabin.voxel, r: MEDIC.cabin.r, at: M });
    rampWalls();
  }
  // (the ramp's treads felt only while it is down; worked out again each time it comes down)
  let rampIn = false;
  function rampWalls() {
    if (!walls || !ramp) return;
    const down = ramp.t >= MEDIC.wayOpen;
    if (down && !rampIn) { const g = rampGeos(); walls.add('medic:ramp', { solid: g, up: g, at: M }); rampIn = true; }
    else if (!down && rampIn) { walls.drop('medic:ramp'); rampIn = false; }
  }

  // ── each frame ────────────────────────────────────────────────────────────────────────────────────────────────
  let rampWant = ramp ? ramp.t : 0, clock = 0;
  const _p = new THREE.Vector3();
  function update(dt, cam = camera, eyes = []) {
    clock += dt; KIT_U.time.value = clock; liveTick(clock);
    // the planet's curve where it stands, seen from the camera (the ground's own rule: src/planet/ground.js CURVE)
    if (cam) { const dx = stand.x - cam.position.x, dz = stand.z - cam.position.z; group.matrix.copy(M); group.matrix.elements[13] -= (dx * dx + dz * dz) * ground.U.uCurve.value; group.matrixWorldNeedsUpdate = true; }
    // the ramp, slowly (the kit's heavy door: five seconds, gently at both ends), its foot unfolding as it goes
    if (ramp && ramp.t !== rampWant) { ONE[0] = ramp; updateDoors(ONE, FAR, dt, rampWant ? 'open' : 'shut'); MD.rampFoot(B); rampWalls(); }
    // the cabin's sliding doors, for whoever is nearest each (in its own frame)
    for (const D of C.built.doors) {
      let best = FAR, bd = Infinity;
      for (const e of eyes) { _p.copy(e).applyMatrix4(inv); const d = _p.distanceToSquared(D.sense); if (d < bd) { bd = d; best = _p.clone(); } }
      ONE[0] = D; updateDoors(ONE, best, dt, 'auto');
    }
    if (beams) beams.update(clock);
  }
  // inside its cabin's rooms (the blueprint's rooms, over the deck)
  function inside(p) {
    _p.copy(p).applyMatrix4(inv);
    if (_p.y < space.deck - 0.3 || _p.y > space.deck + 3) return false;
    return (bp.rooms || []).some((r) => _p.x >= r.rect[0] && _p.x <= r.rect[2] && _p.z >= r.rect[1] && _p.z <= r.rect[3]);
  }
  // (just past the ramp's foot: its hinge on the sill, its two sections down to the ground at its slope, and a step on)
  const R0 = MD.RAMP, foot = new THREE.Vector3(sideSign * (R0.face + (R0.A + R0.B) * Math.cos(R0.slope) + 0.7), 0, (R0.z[0] + R0.z[1]) / 2).applyMatrix4(M);
  const places = placesOf(bp, { deck: space.deck, cockpitFloor: MD.COCKPIT.floor, jobs: ['pilot', 'medic'] });
  const stats = { ms: Math.round(performance.now() - t0), hullMs, cabinMs, bake: Math.round(B.stats.bake?.ms || 0), tris: Math.round(B.stats.tris + C.built.stats.tris), draws: B.stats.draws + C.built.stats.draws + (beams ? 2 : 0) };
  return {
    group, M, inv, stand, side, foot, bp, space, places, beds: patientBeds(bp, space.deck), built: B, cabin: C, stats, addTo, update, inside,
    get rampT() { return ramp ? ramp.t : 0; },
    ramp(k) { rampWant = k ? 1 : 0; },
    dispose() {
      if (walls) { walls.drop('medic:hull'); walls.drop('medic:cabin'); walls.drop('medic:ramp'); }
      group.removeFromParent(); B.dispose(); C.built.dispose(); if (beams) beams.dispose();
      for (const g of [...hull.solid, ...cabin.solid]) g.dispose();
      eachMaterial(hullMats, (m) => m.dispose()); eachMaterial(cabinMats, (m) => m.dispose());
    },
  };
}
