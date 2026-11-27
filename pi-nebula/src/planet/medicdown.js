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
//       settings, its cloud sky if it has air), so its hull is lit as the planet's own things are; sunDir: toward the
//       planet's sun: its hull's shadow on the ground (src/planet/groundshadow.js; none given, none drawn)
//   M.group, M.M (its own frame in the world: x to port, y up from its ground line, z to the nose), M.inv, M.stand
//   M.env                   its cabin's own picture of itself (a person inside is lit by it: src/planet/inside.js)
//   M.addTo(walls)          what a person meets of it, added to where a person can walk (src/walls.js): its hull (its
//                           legs, its shut doors), its cabin (finer, a person slimmer in it, as boarding.js has it), and
//                           its ramp's treads once it is down; each made in its own frame and stood where it is (walls.place)
//   M.update(dt, camera, eyes)   each frame: the planet's curve where it stands, the ramp, the cabin's sliding doors for
//                           whoever is nearest each (eyes: feet in the world), its screens' clock
//   M.ramp(k)               its ramp on its way down (1) or up (0); M.rampT (0 up .. 1 down)
//   M.foot                  a Vector3: on the ground just past its ramp's foot, in the middle of the ramp (the way in)
//   M.place(stand, { down })  put somewhere else (the game builds it ahead, unseen, and puts it where the Medic came down)
//   M.bp, M.space, M.places (src/aboard.js's: every seat and bed of its rooms), M.beds (src/rescueplan.js patientBeds),
//   M.order (src/rescueplan.js restOrder: the places the rescued take, in turn),
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
import { MEDIC, patientBeds, restOrder, rampFelt } from '../rescueplan.js';
import { INSIDE_FILL, FILL_UNIFORMS, insideLight } from './inside.js';
import { groundShadowMaterial, shadowUnder, castsShadow } from './groundshadow.js';

const KIT = new URL('../../kit/', import.meta.url).href;
// the hull's corners' darkness baked coarser than the Ship Lab's (it is made each time a planet is landed on: as the
// wreck's, src/planet/wreckship.js WRECK_BAKE)
export const MEDIC_BAKE = { voxel: 0.12, rays: 12 };
// INSIDE, THE STATION'S LIGHT: src/planet/inside.js (the cabin's materials, and the people in it)
export { INSIDE_FILL };

const ONE = [null], FAR = new THREE.Vector3(1e6, 1e6, 1e6);
const fetchJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error('the Medic: no file at ' + url); return r.json(); });
const breath = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));

const eachMaterial = (mats, fn) => { const seen = new Set(); for (const m of Object.values(mats)) if (m && m.isMaterial && !seen.has(m)) { seen.add(m); fn(m); } };

export async function makeMedicDown({ scene, renderer = null, camera = null, ground, sky = null, sunDir = null, stand, quality = 'medium' }) {
  const t0 = performance.now();
  let side = stand.side === 'starboard' ? 'starboard' : 'port', sideSign = side === 'port' ? 1 : -1;
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
  // (its own spots of the picture marked, so no shadow is drawn over it, its own legs' or the pods': groundshadow.js)
  eachMaterial(hullMats, (m) => castsShadow(m));
  await breath();
  let t = performance.now();
  const B = buildRoom(room, hullMats, { bake: MEDIC_BAKE });
  const hullMs = Math.round(performance.now() - t);
  group.add(B.group);
  // the legs down (the build's own: its gear door shut is down), both ramps up, the starboard opening's cabinets away
  // (his blueprint has both ramps: "ramps": "both"), then this side's ramp down at once
  const rampOf = (s) => B.doors.find((D) => D.piece === 'mdRamp' && Math.sign(D.sense.x) === s);
  let ramp = rampOf(sideSign);
  MD.equipStep(B, false);
  if (ramp) { ONE[0] = ramp; setDoors(ONE, 1); }
  MD.rampFoot(B);
  // ITS SHADOW on the ground, as the wreck's and the pods' (src/planet/groundshadow.js): its hull, its legs and its
  // ramps once more, down the sun's rays (its place carries the planet's curve: update, below)
  const shadowMat = sunDir ? groundShadowMaterial({ ground, sunDir, air: !!sky, curved: true }) : null, shade = shadowMat ? shadowUnder(B.group, shadowMat) : null;
  await breath();
  // ── its cabin, as the game builds it ─────────────────────────────────────────────────────────────────────────────
  t = performance.now();
  const cabinMats = cabinMaterials('light'); livePalette(cabinMats.live, 'vivid');
  const fill = FILL_UNIFORMS();
  eachMaterial(cabinMats, (m) => { if (m.isMeshStandardMaterial) insideLight(m, fill); });
  const C = buildCabinRoom(bp, { space, outer: MD.LAB.cabin.outer, look: 'light', mats: cabinMats });
  group.add(C.built.group);
  const beams = quality === 'low' ? null : makeBeams(C.parts.beams);
  if (beams) { beams.object.position.y = space.deck; group.add(beams.object); }
  const cabinMs = Math.round(performance.now() - t);
  scene.add(group);
  group.updateMatrixWorld(true);
  if (renderer && camera) { try { if (renderer.compileAsync) await renderer.compileAsync(group, camera); else renderer.compile(group, camera); } catch (e) { /* made on the first frame instead */ } }
  // ITS CABIN'S PICTURE OF ITSELF (as src/boarding.js cabinPicture makes the parked ship's): a cube picture from the middle
  // of its biggest room with nothing else of the scene in it (the planet, its sky), under the scene's own lights: what a
  // person inside it is lit by (src/planet/inside.js peopleLight: their shine in the cabin, as in the hangar)
  let env = null;
  if (renderer) {
    try {
      const big = [...bp.rooms].filter((r) => r.ceiling !== 'canopy').sort((a, b) => (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]) - (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]))[0];
      const rt = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 30, rt), put = [];
      cc.position.set((big.rect[0] + big.rect[2]) / 2, space.deck + 1.5, (big.rect[1] + big.rect[3]) / 2).applyMatrix4(M);
      // (everything beside it, and beside each thing it is in, put away for the picture; whatever holds it shown)
      let top = group;
      for (let o = group; o.parent; o = o.parent) { top = o.parent; for (const q of o.parent.children) if (q !== o && !q.isLight && q.visible) { q.visible = false; put.push([q, true]); } if (!o.parent.visible) { o.parent.visible = true; put.push([o.parent, false]); } }
      if (shade) shade.show(false);     // (its shadow is the ground's, not the cabin's)
      top.add(cc); cc.update(renderer, top); top.remove(cc);
      if (shade) shade.show(true);
      for (const [q, v] of put) q.visible = v;
      const pm = new THREE.PMREMGenerator(renderer); env = pm.fromCubemap(rt.texture).texture; rt.dispose(); pm.dispose();
    } catch (e) { console.warn('the Medic set down: no picture of its cabin', e); env = null; }
  }

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
  // (a ramp's treads as they lie all the way down, its foot unfolded: the ramp posed down a moment to take them, then put
  // back as it stands; once for each ramp. Taken as it came past MEDIC.wayOpen, its foot was still unfolding: the treads
  // felt there were up to 5 cm over the ones drawn)
  const treads = new Map();
  const rampGeos = (D) => {
    if (treads.has(D)) return treads.get(D);
    const out = [], m = new THREE.Matrix4(), t0 = D.t;
    ONE[0] = D; setDoors(ONE, 1); MD.rampFoot(B);
    for (const leaf of D.leaves) for (const im of leaf.meshes || []) {
      if (/glass|glow|decal/.test(im.name)) continue;
      im.getMatrixAt(leaf.index, m); const w = geoOf(im.geometry); w.applyMatrix4(m); out.push(w);
    }
    ONE[0] = D; setDoors(ONE, t0); MD.rampFoot(B);
    treads.set(D, out);
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
  // (the ramp's treads, laid once for the ramp on its side and felt as rescueplan.js rampFelt says: walking, once it is
  // down; a way worked out ahead, from the moment it starts down)
  let rampIn = null;
  function rampWalls() {
    if (!walls || !ramp || rampIn === ramp) return;
    const D = ramp, g = rampGeos(D);
    walls.add('medic:ramp', { solid: g, up: g, at: M, when: (pathing) => rampFelt(pathing, rampWant, D.t) });
    rampIn = ramp;
  }

  // ── each frame ────────────────────────────────────────────────────────────────────────────────────────────────
  let rampWant = ramp ? ramp.t : 0, clock = 0;
  const _p = new THREE.Vector3();
  function update(dt, cam = camera, eyes = []) {
    clock += dt; KIT_U.time.value = clock; liveTick(clock);
    // the planet's curve where it stands, seen from the camera (the ground's own rule: src/planet/ground.js CURVE)
    if (cam) { const dx = stand.x - cam.position.x, dz = stand.z - cam.position.z; group.matrix.copy(M); group.matrix.elements[13] -= (dx * dx + dz * dz) * ground.U.uCurve.value; group.matrixWorldNeedsUpdate = true; }
    // the ramp, slowly (the kit's heavy door: five seconds, gently at both ends), its foot unfolding as it goes
    if (ramp && ramp.t !== rampWant) { ONE[0] = ramp; updateDoors(ONE, FAR, dt, rampWant ? 'open' : 'shut'); MD.rampFoot(B); }
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
  const R0 = MD.RAMP, foot = new THREE.Vector3(), footAt = () => foot.set(sideSign * (R0.face + (R0.A + R0.B) * Math.cos(R0.slope) + 0.7), 0, (R0.z[0] + R0.z[1]) / 2).applyMatrix4(M);
  footAt();
  const places = placesOf(bp, { deck: space.deck, cockpitFloor: MD.COCKPIT.floor, jobs: ['pilot', 'medic'] });
  // SET DOWN SOMEWHERE ELSE (the game: made ahead, unseen, while the jump is worked out, and put where the Medic really
  // came down, whichever way round: src/rescue.js): stand as makeMedicDown's; down: its ramp on that side down at once
  // (else it is up, and comes down with M.ramp(1)); the other ramp up. Before or after its walls are added
  function place(st, { down = true } = {}) {
    stand = st; side = st.side === 'starboard' ? 'starboard' : 'port'; sideSign = side === 'port' ? 1 : -1;
    M.makeRotationY(st.yaw).setPosition(st.x, st.y, st.z); inv.copy(M).invert(); group.matrix.copy(M); group.matrixWorldNeedsUpdate = true;
    const was = ramp; ramp = rampOf(sideSign);
    if (was && was !== ramp) { ONE[0] = was; setDoors(ONE, 0); }
    if (ramp) { ONE[0] = ramp; setDoors(ONE, down ? 1 : 0); }
    MD.rampFoot(B); rampWant = down ? 1 : 0; footAt();
    if (walls) { walls.place('medic:hull', M); walls.place('medic:cabin', M); if (rampIn === ramp) walls.place('medic:ramp', M); else rampWalls(); }
  }
  const stats = { ms: Math.round(performance.now() - t0), hullMs, cabinMs, bake: Math.round(B.stats.bake?.ms || 0), tris: Math.round(B.stats.tris + C.built.stats.tris), draws: B.stats.draws + C.built.stats.draws + (beams ? 2 : 0) + (shade ? shade.count : 0), shadows: shade ? shade.count : 0 };
  return {
    group, M, inv, env, get stand() { return stand; }, get side() { return side; }, foot, bp, space, places, beds: patientBeds(bp, space.deck), order: restOrder(bp, space.deck, places), built: B, cabin: C, stats, addTo, update, inside, place,
    get rampT() { return ramp ? ramp.t : 0; },
    ramp(k) { rampWant = k ? 1 : 0; },
    dispose() {
      if (walls) { walls.drop('medic:hull'); walls.drop('medic:cabin'); walls.drop('medic:ramp'); }
      if (shade) shade.dispose(); if (shadowMat) shadowMat.dispose();
      group.removeFromParent(); B.dispose(); C.built.dispose(); if (beams) beams.dispose();
      for (const g of [...hull.solid, ...cabin.solid, ...[...treads.values()].flat()]) g.dispose(); if (env) env.dispose();
      eachMaterial(hullMats, (m) => m.dispose()); eachMaterial(cabinMats, (m) => m.dispose());
    },
  };
}
