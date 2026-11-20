// BOARDING THE PARKED SHIPS: walk up a ship's way in (the Explorer's airstair, the Medic's ramps and its crew door's
// stair) into its real cabin, the rooms the Ship Lab builds from the ship's blueprint, and back out.
//
//   const B = makeBoarding({ W, walls, quality })     W: the station (station.js), walls: where a person can walk
//   B.update(dt, { player, eyes, camera })            once a frame, before W.frame: loads a ship's cabin when someone
//                                                      (the player, or the title's camera) is near it and drops it when
//                                                      they have gone; works its doors; the light as you go in and out
//   B.ships                                            [{ id, state ('out' | 'loading' | 'in'), ... }]
//   B.inside(p)                                        the ship whose cabin a point is in (or null)
//   B.where(p)                                         where aboard: 'explorer/mess' (the ship and its room), or null
//   B.core(id)                                         a ship's own reactor core: where to stand before it, where it is
//   B.fly(id, D)                                       a ship flown (src/flying.js): its cabin drawn where it is now
//   B.stand(id, D)                                     a ship set down somewhere else than it is parked (below)
//   B.hold(id, on)                                     a ship not parked yet (landing): its cabin and ways left alone
//
// A SHIP SET DOWN BY HAND STANDS WHERE THE PILOT PUT IT (the game's maker, 2026-11-18: "I don't wan the ship taking
// over ... if the pilot sets down and is still crooked then I would hope the crane can just compensate for it ... Even
// if they just come straight in and land it nose-in, that should be okay ... Once they leave the hanger and come back
// then the ship should be reset in it's proper parking spot"). B.stand(id, D): D, a Matrix4 from where the ship is
// parked to where it stands (a turn about straight up and a move across the floor; null: its proper parking place).
// Its cabin, the walls a person feels in it, its hull and legs, its lift's moving floor and the fence round where the
// lift lands, and every spot asked for (spots) are then where the ship is: s.M is the cabin where it stands, s.M0
// where it is parked, s.D the move between them. Nothing is built again: the walls are asked in the ship's own frame
// (walls.place), so the cabin's narrow doors are exactly as wide as they were. `stands` counts the moves, for whoever
// keeps something that depends on where a ship is (src/people.js: the patches kept off; src/mission.js: the line).
//
// THE SAME FOR A SHIP SHOVED ABOUT ITS HANGAR (the game's maker, 2026-11-18, of the Miner flown into another ship's
// hangar: "It would even be appropriate for the other ship to get moved around if they rammed it. But it would be reset
// the next time they entered into the other hanger"; src/visit.js): B.stand('explorer', D) and B.stand('medic', D). Their
// ways in follow as the Miner's lift does: the airstair, the ramps and the crew door's stair are drawn with the ship
// (visit.js), each way's own point and patch of floor are kept where the ship is parked and a person is brought there
// to be asked about them, its treads and its shut door are felt where the ship stands (walls.place, a door's `fr`).
//
// HOW (nothing here knows a coordinate: ships, rooms and doors are found by name in the station file):
//   - Each ship parked in the station is a room of the station file ('ship-explorer', drawn with its hangar). Its cabin
//     is built only while someone is in that hangar or the way into it (each cabin is about 80-110k triangles), by the
//     kit's own cabin code (kit/ships/cabin-room.js, as the Ship Lab builds it), placed where the ship is parked.
//   - The cabin's walls, floors and furniture are added to where a person can walk (walls.add, from the cabin as built),
//     and so are the ship's ways in, each a door of the ship that comes down to the floor (its stair or ramp), once it
//     is down: up its treads into the ship.
//   - The ways in open as a person comes near, only while the cabin is in (otherwise there is nothing behind them),
//     and close behind; they are heavy and slow, and never come down onto anyone (WAY_REACH below); the cabin's own
//     sliding doors open as the station's do.
//   - Inside, the light is the Ship Lab's: the cabin's own baked strips and the beams of dusty light, the picture a
//     little brighter (the lab's exposure) and the station's haze held off; the station's saved light outside is as it
//     was.
import * as THREE from 'three';
import { updateDoors, setDoors } from '../kit/layout.js';
import { placeMatrix } from '../kit/grid.js';
import { makeBeams } from '../kit/beams.js';
import { cabinMaterials } from '../kit/ships/cabin-built.js';
import { buildCabinRoom } from '../kit/ships/cabin-room.js';
import { liveTick, livePalette, FLICKER_TAG } from '../kit/shipparts/cabin/live.js';
import { corePulse, CORE_LOOK } from '../kit/shipparts/cabin/livecore.js';
import { CORE_TAG } from '../kit/shipparts/cabin/reactor.js';
import * as EB from '../kit/ships/explorer-built.js';
import * as MD from '../kit/ships/medic-built.js';
import * as MB from '../kit/ships/miner-built.js';
import { shine } from './player.js';
import { frameOf } from './standing.js';
import { coreIn } from './missions.js';

// THE SHIPS THAT CAN BE BOARDED: the station file's room for each parked ship, its module (its LAB says how its cabin
// meets its hull: kit/ships/<ship>-built.js), the blueprint the game's maker picked, and its ways in (the ship's
// doors that come down to the floor, by piece; `step`: what the ship's module does each frame to pose them, as the
// Medic's ramp unfolds its foot). `lifts`: a way in that people ride instead (the Miner's belly lift: LIFTS below),
// by piece, with where to stand on the hangar floor to step onto it (`foot`: in the ship's frame, x to port, z to the
// nose, on the ground; beside the open front of its side railings). (The Hauler is paused: not boarded.)
export const SHIPS = [
  { id: 'explorer', zone: 'ship-explorer', lab: EB.LAB, bp: 'explorer-c-row', ways: ['ebAirstair'] },
  { id: 'medic', zone: 'ship-medic', lab: MD.LAB, bp: 'medic-open-bench', ways: ['mdRamp', 'mdCrewDoor'], step: (doors) => MD.rampFoot({ doors }) },
  { id: 'miner', zone: 'ship-miner', lab: MB.LAB, bp: 'miner-ore-cockpit', ways: [], lifts: [{ piece: 'mbLift', foot: [2.6, -0.15], drop: MB.CLIFT.drop }] },
];
// the ships that are flown by hand, by their rooms: each may be set down somewhere else than it is parked (B.stand)
export const FLOWN = ['ship-miner'];
// ... and the ships parked in the other two hangars, which a flown one can shove about their own hangar's floor (the
// game's maker, 2026-11-18, of the Miner flown into another ship's hangar: "It would even be appropriate for the other
// ship to get moved around if they rammed it. But it would be reset the next time they entered into the other hanger":
// src/visit.js). B.stand(id, D) is the same for them: the cabin, the ways in (the Explorer's airstair, the Medic's
// ramps and its crew door's stair), the walls a person feels and every spot asked for are where the ship stands.
// STANDS_ANYWHERE: every room of the station that is felt as a part of its own for this (walls.js `apart`).
export const SHOVED = ['ship-explorer', 'ship-medic'];
export const STANDS_ANYWHERE = [...FLOWN, ...SHOVED];
// how near (m, along the floor) a person must be to a way in for it to come down (the door's own reach, if it has one);
// how long (s) after everyone has left a ship's hangar its cabin is dropped; the cabin's look
export const NEAR = 4.5, LINGER = 4, LOOK = 'light';
// a way in is a heavy door and comes down slowly (the kit: five seconds, gently at both ends), so it starts for whoever
// comes within WAY_REACH of its foot, and nobody is ever under it: the patch of floor it comes down on (its own box
// when down, CLEAR wider) is kept clear while it moves, and it waits while anyone is still standing there. A person
// walks through its doorway only once it is fully down (WAY_OPEN). The game's maker, of the Explorer's door: "a total
// safety hazard dropping that fast. Can you imagine if someone was standing there?"
export const WAY_REACH = 7, CLEAR = 0.35, WAY_OPEN = 0.97;
// where a person can walk in a cabin: its walls felt on a finer grid than the station's (m), and a person there
// slimmer (half width, m; the station's is 0.28), as the cabins' doors are drawn for a person 0.5 m across (a washroom's
// door is 0.6 m)
export const CABIN_WALLS = { voxel: 0.05, r: 0.15 };
// inside: the Ship Lab's exposure (the station's is 0.74) and the station's haze pushed back; how fast each eases (/s)
export const INSIDE = { exposure: 1.0, fogNear: 40, fogFar: 140, ease: 3 };
// THE POOLS: as in the Ship Lab, a few real-time lights set where the cabin's pools of light are in the room the camera
// is in (the strips under the cabinets, the benches' toes, the door frames, the ceilings' downlights: cabin-built.js
// POOLS), on high quality only (every lit surface in view pays for them); how many
export const POOL_N = 10;
// THE LIFTS (a ship's way in that people ride: the Miner's belly lift, kit/ships/miner-built.js mbLift 'belly, cabin').
// One heavy kit door ('lift': 0 up, its platform the middle of the airlock's floor; 1 down on the hangar floor), driven
// here, never by the station's frame:
//   - it comes down for whoever comes within WAY_REACH of it on the hangar floor while nobody is aboard, waits on the
//     ground while they are near, and goes back up once nobody is near it and nobody is on it;
//   - the player standing still on its tread for RIDE.wait seconds (feet on it, RIDE.inset inside its edge) is carried
//     (the station's people never board a ship; one of them standing on it holds the ride back):
//     up if it is down, down if it is up (walking across it in the airlock does not). Once carried, they must step off
//     before it carries them again;
//   - coming down, a fence round the floor it lands on stops anyone walking in under it (the way-finder too), and it
//     waits while anyone not riding stands there, the player walked off it first, as the ways do;
//   - its riders move with it: its platform and railings are a moving floor (walls.lift), and the feet of whoever
//     stands on them go up and down with them, smoothly (the kit's heavy door: it starts and lands gently).
export const RIDE = { wait: 1.0, still: 0.15, inset: 0.15 };

const breath = () => new Promise((done) => { let went = false; const go = () => { if (!went) { went = true; done(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 60); });
const FAR = new THREE.Vector3(1e6, 1e6, 1e6), ONE = [null];
const files = new Map();
const fetchJSON = (url) => { if (!files.has(url)) files.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error('boarding: no file at ' + url); return r.json(); })); return files.get(url); };

export function makeBoarding({ W, walls, quality = 'high' }) {
  const mats = cabinMaterials(LOOK); livePalette(mats.live, 'vivid');
  const base = { exposure: W.renderer.toneMappingExposure, fogNear: W.scene.fog?.near ?? 7, fogFar: W.scene.fog?.far ?? 60 };
  const look = { inside: 0 };
  // (in the scene from the start, dark until a cabin's room wants them: added later, every material would be made again)
  const pools = quality === 'high' ? Array.from({ length: POOL_N }, () => new THREE.PointLight(0xffffff, 0, 2, 2)) : [];
  for (const L of pools) W.scene.add(L);
  let poolKey = null;
  const ships = [];
  for (const S of SHIPS) {
    const zd = W.R.rooms?.find((r) => r.id === S.zone), zone = W.room(S.zone);
    if (!zd || !zone || !zd.pieces?.length) { console.info('boarding: the station has no ' + S.zone); continue; }
    // the zones a person is near the ship in: the hangar it is drawn with, and the way into that hangar
    const hangar = zone.with?.[0], near = new Set([hangar, ...W.built.zones.filter((z) => z.id.startsWith('stub-' + S.id)).map((z) => z.id)].filter(Boolean));
    // the ways in: the ship's doors that come down to the floor, driven here (the station's frame leaves them alone)
    const ways = W.built.doors.filter((D) => D.zone === S.zone && D.hold == null && S.ways.includes(D.piece));
    for (const D of ways) { W.driven.add(D); W.keepShut.delete(D); }
    const entries = ways.map((D) => walls.doors.find((d) => d.D === D)).filter(Boolean);
    for (const e of entries) { e.locked = true; e.open = WAY_OPEN; }
    // the lifts: driven here; their door's box never stops anyone (the lift is a moving floor of its own: liftParts)
    const lifts = (S.lifts || []).flatMap((Lf) => W.built.doors.filter((D) => D.zone === S.zone && D.hold == null && D.piece === Lf.piece).map((D) => ({ ...Lf, D, carried: new Set(), key: null, patch: null })));
    for (const L of lifts) { W.driven.add(L.D); W.keepShut.delete(L.D); const e = walls.doors.find((d) => d.D === L.D); if (e) e.when = () => false; }
    ships.push({ ...S, zd, zone, hangar, near, ways, lifts, entries, state: 'out', away: 0, cabin: null, wayParts: new Map(), M: null, M0: null, inv: null, D: new THREE.Matrix4(), Di: new THREE.Matrix4(), moved: false, stats: null });
  }
  let stands = 0;

  // ── a ship's cabin, built ──────────────────────────────────────────────────────────────────────────────────────
  async function load(s) {
    s.state = 'loading';
    const t0 = performance.now(), times = {};
    try {
      const bp = await fetchJSON(new URL('../kit/ships/' + s.bp + '.blueprint.json', import.meta.url));
      const space = await fetchJSON(new URL('../assets/ships/' + bp.shell + '.space.json', import.meta.url));
      await breath();
      if (s.state !== 'loading') return;
      // where the ship is parked: its hull's placement, its frame's feet on the floor (the cabin is built with its deck
      // at the space's deck, as the Ship Lab builds it), and as much higher as the ship stands on its legs (its LAB.stand:
      // the Miner's pieces are raised by it, kit/layout.js)
      const pl = s.zd.pieces[0], off = pl.off || [0, 0, 0];
      // (M0: where it is parked; M: where it stands, which is the same unless it was set down by hand somewhere else)
      s.M0 = placeMatrix({ ...pl, off: [off[0], off[1] - space.deck + (s.lab.stand || 0), off[2]] }, new THREE.Matrix4());
      s.M = new THREE.Matrix4().multiplyMatrices(s.D, s.M0);
      s.inv = s.M.clone().invert(); s.bpData = bp; s.space = space;
      let t = performance.now();
      const C = buildCabinRoom(bp, { space, outer: s.lab.cabin.outer, look: LOOK, mats });
      times.build = Math.round(performance.now() - t);
      const group = new THREE.Group(); group.name = 'cabin:' + s.id; group.matrixAutoUpdate = false; group.matrix.copy(s.M);
      group.add(C.built.group);
      const beams = quality === 'low' ? null : makeBeams(C.parts.beams);
      if (beams) { beams.object.position.y = space.deck; group.add(beams.object); }
      await breath();
      if (s.state !== 'loading') { C.built.dispose(); beams?.dispose(); return; }
      // where a person can walk: its walls, floors and furniture, and its doors, in the station's frame as the ship is
      // parked, and stood where the ship stands (walls.place: asked in the ship's own frame, never worked out again)
      t = performance.now();
      const solid = [], up = [], doors = [], _b = new THREE.Box3(), _m = new THREE.Matrix4();
      for (const z of C.built.zones) for (const k of ['solid', 'floor', 'glass']) {
        const g = z.merged[k]; if (!g) continue;
        const w = new THREE.BufferGeometry(); w.setAttribute('position', g.attributes.position.clone()); w.setIndex(g.index); w.applyMatrix4(s.M0);
        solid.push(w); if (k !== 'glass') up.push(w);
      }
      for (const D of C.built.doors) {
        const box = new THREE.Box3();
        for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); box.union(_b.copy(im.geometry.boundingBox).applyMatrix4(_m.copy(leaf.M).multiply(leaf.base))); }
        if (!box.isEmpty()) doors.push({ D, box: box.applyMatrix4(s.M0) });
      }
      walls.add('cabin:' + s.id, { solid, up, doors, voxel: CABIN_WALLS.voxel, r: CABIN_WALLS.r, at: s.moved ? s.D : null });
      s.lifts.forEach((L, i) => liftParts(s, L, i));
      times.walls = Math.round(performance.now() - t);
      W.scene.add(group);
      // (its materials' programs made now, not on the first frame it is seen)
      t = performance.now();
      if (W.renderer.compileAsync) await W.renderer.compileAsync(group, W.camera); else W.renderer.compile(group, W.camera);
      times.compile = Math.round(performance.now() - t);
      if (s.state !== 'loading') { W.scene.remove(group); walls.drop('cabin:' + s.id); for (const k of s.wayParts.keys()) walls.drop(k); s.wayParts.clear(); C.built.dispose(); beams?.dispose(); return; }
      // the cabin's own picture of itself, for the people walking in it (the player's suit lit by its strips)
      t = performance.now();
      const env = cabinPicture(s, group);
      times.probe = Math.round(performance.now() - t);
      s.cabin = { C, group, beams, env, tris: C.built.stats.tris };
      for (const e of s.entries) e.locked = false;
      s.state = 'in';
      s.stats = { ms: Math.round(performance.now() - t0), ...times, tris: Math.round(C.built.stats.tris), draws: C.built.stats.draws + (beams ? 2 : 0), doors: C.built.doors.length, bake: C.built.stats.bake.ms };
      console.info('boarding: the ' + s.id + '\'s cabin is in: ' + JSON.stringify(s.stats));
    } catch (e) {
      s.state = 'broken'; console.error('boarding: the ' + s.id + '\'s cabin could not be built: ' + (e?.message || e));
    }
  }
  function drop(s) {
    if (s.state === 'loading') { s.state = 'out'; return; }
    if (s.state !== 'in') return;
    const c = s.cabin; W.scene.remove(c.group); c.C.built.dispose(); c.beams?.dispose(); c.env?.dispose();
    walls.drop('cabin:' + s.id);
    for (const k of s.wayParts.keys()) walls.drop(k);
    s.wayParts.clear();
    for (const L of s.lifts) { L.key = L.patch = null; L.carried.clear(); }
    for (const e of s.entries) e.locked = true;
    s.cabin = null; s.flown = null; s.state = 'out'; poolKey = null;
    for (const L of pools) { L.intensity = 0; L.userData.pool = null; }
    console.info('boarding: the ' + s.id + '\'s cabin is dropped');
  }
  // (a cube picture from the middle of the cabin's biggest room, with the station's other rooms hidden: the light a
  // person standing in the cabin is lit by)
  const pmrem = new THREE.PMREMGenerator(W.renderer);
  function cabinPicture(s, group) {
    const big = [...s.bpData.rooms].filter((r) => r.ceiling !== 'canopy').sort((a, b) => (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]) - (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]))[0];
    if (!big) return null;
    const at = new THREE.Vector3((big.rect[0] + big.rect[2]) / 2, s.space.deck + 1.5, (big.rect[1] + big.rect[3]) / 2).applyMatrix4(s.M);
    const rt = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 30, rt);
    cc.position.copy(at); W.scene.add(cc);
    const shown = W.built.group.visible, sky = W.sky.object.visible;
    // (and not the station's outside, src/outside.js: the cabin's picture of itself is as it was before there was one)
    const outside = W.scene.getObjectByName('outside'), outShown = outside ? outside.visible : false;
    W.built.group.visible = false; W.sky.object.visible = false; if (outside) outside.visible = false;
    cc.update(W.renderer, W.scene);
    W.built.group.visible = shown; W.sky.object.visible = sky; W.scene.remove(cc); if (outside) outside.visible = outShown;
    const env = pmrem.fromCubemap(rt.texture).texture; rt.dispose();
    return env;
  }

  // ── a way in, once it is down: its treads to walk on (the door's leaves as they stand, in the station's frame) ──
  const _im = new THREE.Matrix4();
  function wayDown(s, D, i) {
    const key = 'way:' + s.id + ':' + i; if (s.wayParts.has(key)) return;
    const geos = [];
    for (const leaf of D.leaves) for (const im of leaf.meshes || []) {
      if (/glass|glow|decal/.test(im.name)) continue;
      im.getMatrixAt(leaf.index, _im);
      const w = new THREE.BufferGeometry(); w.setAttribute('position', im.geometry.attributes.position.clone()); w.setIndex(im.geometry.index); w.applyMatrix4(_im);
      geos.push(w);
    }
    // (only while it is down; a way worked out ahead counts it down, as it comes down for whoever walks up to it)
    // (made where the ship is parked, as its leaves are kept, and stood where the ship stands)
    walls.add(key, { solid: geos, up: geos, when: (pathing) => (pathing ? s.state === 'in' : D.t > 0.97), at: s.moved ? s.D : null });
    s.wayParts.set(key, D);
  }

  // ── a way in, on its way down: the patch of floor it comes down on, kept clear (see WAY_REACH). Worked out once, by
  // posing the way down and back: its walked-on leaves' box there (a still leaf, its outside skin, lies under those),
  // CLEAR wider, from the floor to over a person's head; added to
  // where nobody can walk for as long as the way is coming down (D.coming). Anyone caught on it is moved off it, as
  // walls.js does for anywhere a person cannot stand.
  const _fb = new THREE.Box3();
  function keepClear(s, D, i) {
    const key = 'clear:' + s.id + ':' + i; if (s.wayParts.has(key)) return;
    s.wayParts.set(key, D);
    const t0 = D.t, box = new THREE.Box3();
    ONE[0] = D; setDoors(ONE, 1);
    for (const leaf of D.leaves) {
      for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); im.getMatrixAt(leaf.index, _im); box.union(_fb.copy(im.geometry.boundingBox).applyMatrix4(_im)); }
    }
    ONE[0] = D; setDoors(ONE, t0);
    if (box.isEmpty()) return;
    const y0 = box.min.y - 0.1;
    D.foot = new THREE.Box3(new THREE.Vector3(box.min.x - CLEAR, y0, box.min.z - CLEAR), new THREE.Vector3(box.max.x + CLEAR, y0 + 2.2, box.max.z + CLEAR));
    const size = D.foot.getSize(new THREE.Vector3()), c = D.foot.getCenter(new THREE.Vector3());
    const g = new THREE.BoxGeometry(size.x, size.y, size.z); g.translate(c.x, c.y, c.z);
    walls.add(key, { solid: [g], when: (pathing) => !pathing && !!D.coming, at: s.moved ? s.D : null });
  }

  // a person standing on a way's patch of floor as it is about to come down, walked off it at an easy pace: out past
  // its nearer side, or past its far end if that is nearer (never toward the ship)
  const _c = new THREE.Vector3(), _h = new THREE.Vector3(), _mid = new THREE.Vector3();
  // (worked out where the ship is parked, as the patch is kept: the person brought there and taken back)
  const _sp = new THREE.Vector3();
  function standClear(s, D, pw, dt) {
    const p = s.moved ? _sp.copy(pw).applyMatrix4(s.Di) : pw;
    const f = D.foot; f.getCenter(_c); f.getSize(_h).multiplyScalar(0.5);
    _mid.set(0, 0, 0).applyMatrix4(s.M0 || s.M);
    let ox = D.sense.x - _mid.x, oz = D.sense.z - _mid.z; const L = Math.hypot(ox, oz) || 1; ox /= L; oz /= L;   // (out from the ship)
    const sx = -oz, sz = ox;                                                                                 // (along its side)
    const a = (p.x - _c.x) * sx + (p.z - _c.z) * sz, b = (p.x - _c.x) * ox + (p.z - _c.z) * oz;
    const side = Math.abs(sx) * _h.x + Math.abs(sz) * _h.z - Math.abs(a), end = Math.abs(ox) * _h.x + Math.abs(oz) * _h.z - b;
    const k = Math.min(1.4 * dt, Math.min(side, end) + 0.3), sg = a < 0 ? -1 : 1;
    if (side <= end) { p.x += sx * sg * k; p.z += sz * sg * k; } else { p.x += ox * k; p.z += oz * k; }
    if (p !== pw) { p.applyMatrix4(s.D); pw.x = p.x; pw.z = p.z; }
  }

  // ── a lift (LIFTS): its moving floor, its patch, and each frame's ride ─────────────────────────────────────────
  // (how far the platform is below where it stands up: the kit poses a heavy door's leaves at smooth(smooth(t)) of their
  // slide, kit/layout.js setLeaf)
  const smooth = (t) => t * t * (3 - 2 * t), liftDy = (L) => -L.drop * smooth(L.D.heavy ? smooth(L.D.t) : L.D.t);
  // its platform and railings, as they stand up (t 0), as a part of the walls that moves (walls.lift); and its patch:
  // a FENCE round the floor its platform comes down on, CLEAR wide, from the floor to over a person's head, shut to
  // walkers only while the lift comes down: nobody walks in under it, and its riders, inside the fence, are not in it
  // (anyone already under it when it starts: it waits, and the player is walked off, liftStep)
  function liftParts(s, L, i) {
    const D = L.D, t0 = D.t, geos = [], box = new THREE.Box3(), low = new THREE.Box3();
    ONE[0] = D; setDoors(ONE, 0);
    for (const leaf of D.leaves) for (const im of leaf.meshes || []) {
      if (!/platform|railing/.test(im.name) || /glass|glow|decal/.test(im.name)) continue;
      im.getMatrixAt(leaf.index, _im);
      const w = new THREE.BufferGeometry(); w.setAttribute('position', im.geometry.attributes.position.clone()); w.setIndex(im.geometry.index); w.applyMatrix4(_im);
      geos.push(w); w.computeBoundingBox(); if (/platform/.test(im.name)) box.union(w.boundingBox);
    }
    ONE[0] = D; setDoors(ONE, t0);
    if (!geos.length || box.isEmpty()) return;
    L.key = 'lift:' + s.id + ':' + i; L.box = box; L.top0 = box.max.y;
    // (and, to walk on only, its tread carried out over the few centimetres between its edge and the hatch's rim, so a
    // step off it at the top lands on the deck, not in the gap)
    const e = 0.09, tread = new THREE.BufferGeometry();
    tread.setAttribute('position', new THREE.Float32BufferAttribute([box.min.x - e, box.max.y, box.min.z - e, box.max.x + e, box.max.y, box.min.z - e, box.max.x + e, box.max.y, box.max.z + e, box.min.x - e, box.max.y, box.max.z + e], 3));
    tread.setIndex([0, 2, 1, 0, 3, 2]);
    walls.add(L.key, { solid: geos, up: [...geos, tread], voxel: CABIN_WALLS.voxel, at: s.moved ? s.D : null });
    const y0 = box.max.y - L.drop - 0.1, H = 2.2, fence = [], C = CLEAR, [a0, a1, b0, b1] = [box.min.x, box.max.x, box.min.z, box.max.z];
    for (const [x0, x1, z0, z1] of [[a0 - C, a1 + C, b0 - C, b0], [a0 - C, a1 + C, b1, b1 + C], [a0 - C, a0, b0, b1], [a1, a1 + C, b0, b1]]) {
      const g = new THREE.BoxGeometry(x1 - x0, H, z1 - z0); g.translate((x0 + x1) / 2, y0 + H / 2, (z0 + z1) / 2); fence.push(g);
    }
    L.patch = 'liftpatch:' + s.id + ':' + i;
    walls.add(L.patch, { solid: fence, when: () => !!D.coming, at: s.moved ? s.D : null });
    walls.lift(L.key, liftDy(L));
    // (its patch on the hangar floor at the bottom, for who is standing there, and where it senses people from)
    low.set(new THREE.Vector3(box.min.x - CLEAR, box.max.y - L.drop - 0.3, box.min.z - CLEAR), new THREE.Vector3(box.max.x + CLEAR, box.max.y - L.drop + 1.0, box.max.z + CLEAR));
    D.foot = low;
    s.wayParts.set(L.key, D); s.wayParts.set(L.patch, D);
  }
  // (each person's feet: how long they have stood still, by their own Vector3)
  const stillOf = new WeakMap();
  function stillFor(p, dt) {
    let q = stillOf.get(p); if (!q) stillOf.set(p, (q = { x: p.x, z: p.z, t: 0 }));
    const v = Math.hypot(p.x - q.x, p.z - q.z) / Math.max(dt, 1e-4); q.t = v < RIDE.still ? q.t + dt : 0; q.x = p.x; q.z = p.z;
    return q.t;
  }
  // (the lift's own boxes are kept where the ship is parked: a person is brought there to be asked about them, `at`)
  const _at = [new THREE.Vector3(), new THREE.Vector3()]; let _ai = 0;
  const at = (s, e) => (s.moved ? _at[_ai = 1 - _ai].copy(e).applyMatrix4(s.Di) : e);
  const onTread = (L, e, top) => e.x > L.box.min.x + RIDE.inset && e.x < L.box.max.x - RIDE.inset && e.z > L.box.min.z + RIDE.inset && e.z < L.box.max.z - RIDE.inset && Math.abs(e.y - top) < 0.07;
  function liftStep(s, L, dt, eyes, player) {
    const D = L.D, inCabin = s.state === 'in' && L.key, top = inCabin ? L.top0 + liftDy(L) : 0;
    // (the player rides it; the station's people never board a ship: one standing on its tread holds a ride back)
    const riders = inCabin && player && onTread(L, at(s, player.pos), top) ? [player.pos] : [], others = inCabin ? eyes.filter((e) => e !== player?.pos && onTread(L, at(s, e), top)) : [];
    for (const p of L.carried) if (!riders.includes(p)) L.carried.delete(p);   // (stepped off: may ride again)
    const waited = riders.map((e) => stillFor(e, dt)), ready = riders.some((e, k) => waited[k] >= RIDE.wait && !L.carried.has(e));
    for (const e of eyes) if (!riders.includes(e)) stillOf.delete(e);
    const callers = inCabin && eyes.some((e) => { if (riders.includes(e)) return false; const q = at(s, e); return q.y < D.foot.min.y + 1.0 && Math.hypot(q.x - D.sense.x, q.z - D.sense.z) < WAY_REACH; });
    const aboard = inCabin && eyes.some((e) => !riders.includes(e) && inside(e) === s);
    const atRest = L.goal == null || D.t === L.goal;
    if (!inCabin) L.goal = 0;
    else if (atRest) {
      if (ready && !others.length) { L.goal = D.t >= 1 ? 0 : 1; for (const e of riders) L.carried.add(e); }
      else if (D.t <= 0 && callers && !aboard && !riders.length) L.goal = 1;
      else if (D.t >= 1 && !callers && !riders.length) L.goal = 0;
      else L.goal = D.t >= 1 ? 1 : 0;
    }
    // (coming down: its patch of floor shut to walkers; it waits while anyone not riding stands there, and the player
    // standing there is walked off it first)
    D.coming = !!inCabin && L.goal === 1 && D.t < 1;
    const onPatch = (e) => { if (riders.includes(e)) return false; const q = at(s, e); return q.x > D.foot.min.x && q.x < D.foot.max.x && q.z > D.foot.min.z && q.z < D.foot.max.z && q.y < D.foot.max.y; };
    const waits = D.coming && eyes.some(onPatch);
    if (waits && player && onPatch(player.pos)) standClear(s, D, player.pos, dt);
    if (D.t !== L.goal && !waits) {
      D.t = L.goal > D.t ? Math.min(L.goal, D.t + dt * D.speed) : Math.max(L.goal, D.t - dt * D.speed);
      ONE[0] = D; setDoors(ONE, D.t);
      if (L.key) walls.lift(L.key, liftDy(L), riders);
    }
  }

  // the room of a ship's cabin a point is in (its blueprint's room), or null
  function roomOf(s, p) {
    const inv = s.flown && !aboard(s, p, s.inv) ? s.flown.inv : s.inv;
    _p.copy(p).applyMatrix4(inv);
    return s.bpData.rooms.find((r) => _p.x >= r.rect[0] && _p.x <= r.rect[2] && _p.z >= r.rect[1] && _p.z <= r.rect[3]) || null;
  }
  // is a point in a ship's cabin, the ship standing where `inv` undoes (parked, or flown to)?
  function aboard(s, p, inv) {
    _p.copy(p).applyMatrix4(inv);
    const y = _p.y - s.space.deck; if (y < -0.4 || y > 3.4) return false;
    return s.bpData.rooms.some((r) => _p.x >= r.rect[0] - 0.1 && _p.x <= r.rect[2] + 0.1 && _p.z >= r.rect[1] - 0.1 && _p.z <= r.rect[3] + 0.1);
  }
  // which ship's cabin a point is in (its rooms, deck to ceiling)
  const _p = new THREE.Vector3();
  function inside(p) {
    for (const s of ships) {
      if (s.state !== 'in') continue;
      // (a ship being flown: the crew member's body stays where it is parked, the camera rides in it where it is now)
      if (aboard(s, p, s.inv) || (s.flown && aboard(s, p, s.flown.inv))) return s;
    }
    return null;
  }

  // ── each frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  function update(dt, { player = null, eyes = [], camera = W.camera } = {}) {
    const who = player ? player.pos : camera.position, here = W.zoneAt(who)?.id;
    const inShip = inside(who);
    for (const s of ships) {
      // near: in its hangar or the way into it (or in its cabin)
      const near = s.near.has(here) || inShip === s;
      s.away = near ? 0 : s.away + dt;
      if (near && s.state === 'out' && !s.held) load(s);
      else if (!near && s.away > LINGER && (s.state === 'in' || s.state === 'loading')) drop(s);
      // the ways in: down for anyone near them while the cabin is in, up otherwise
      s.ways.forEach((D, i) => {
        let open = false;
        // (the way's own point and patch are kept where the ship is parked: a person is brought there to be asked about
        // them, `at`, as for a lift, when the ship stands somewhere else)
        if (s.state === 'in') {
          const reach = Math.max(D.near || NEAR, WAY_REACH);
          for (const e0 of eyes) { const e = at(s, e0); if (Math.hypot(e.x - D.sense.x, e.z - D.sense.z) < reach && Math.abs(e.y - D.sense.y) < 3) { open = true; break; } }
          keepClear(s, D, i);
        }
        // (on its way down: its patch of floor is shut to walkers, and it waits while anyone still stands on it)
        D.coming = open && D.t < 1;
        const onPatch = (e0) => { const e = at(s, e0); return e.x > D.foot.min.x && e.x < D.foot.max.x && e.z > D.foot.min.z && e.z < D.foot.max.z && e.y < D.foot.min.y + 1.4; };
        const waits = D.coming && D.foot && eyes.some(onPatch);
        // (the player standing there is walked off it first, the shortest way that is not into the ship's side)
        if (waits && player && onPatch(player.pos)) standClear(s, D, player.pos, dt);
        if (!waits) { ONE[0] = D; updateDoors(ONE, FAR, dt, open ? 'open' : 'shut'); }
        if (D.t >= 1 && s.state === 'in') wayDown(s, D, i);
      });
      if (!s.held) for (const L of s.lifts) liftStep(s, L, dt, eyes, player);
      if (s.step) s.step(s.ways);
      if (s.state !== 'in') continue;
      const c = s.cabin;
      // the cabin's sliding doors, for whoever is nearest each
      for (const D of c.C.built.doors) {
        let best = FAR, bd = Infinity;
        for (const e of eyes) { _p.copy(e).applyMatrix4(s.inv); const d = _p.distanceToSquared(D.sense); if (d < bd) { bd = d; best = _p.clone(); } }
        ONE[0] = D; updateDoors(ONE, best, dt, 'auto');
      }
      // drawn with its hangar
      c.group.visible = (s.zone.group.visible || inShip === s) && !s.held;
      c.beams?.update(W.dust ? performance.now() / 1000 : 0);
    }
    const now = performance.now() / 1000, flick = liveTick(now), core = corePulse(now, CORE_LOOK);
    // the pools of the room the camera is in
    if (pools.length) {
      const cs = inside(camera.position), r = cs ? roomOf(cs, camera.position) : null, key = cs && r ? cs.id + '|' + r.id : null;
      if (key !== poolKey || (cs && cs.flown)) {      // (a ship in flight: its pools of light ride with it)
        poolKey = key;
        const mine = r ? (cs.cabin.C.parts.pools || []).filter((p) => p.room === r.id).sort((a, b) => b.i - a.i).slice(0, POOL_N) : [];
        pools.forEach((L, i) => { const p = mine[i]; L.userData.pool = p || null; L.intensity = p ? p.i : 0; if (!p) return; L.position.set(p.at[0], p.at[1] + cs.space.deck, p.at[2]).applyMatrix4(cs.flown ? cs.flown.M : cs.M); L.color.setRGB(...p.color); L.distance = p.reach; });
      }
      for (const L of pools) { const p = L.userData.pool; if (p?.tag === FLICKER_TAG) L.intensity = p.i * flick; else if (p?.tag === CORE_TAG) L.intensity = p.i * core; }
    }
    // the light: the lab's inside, the station's outside (by where the camera is)
    const camIn = inside(camera.position);
    look.inside += ((camIn ? 1 : 0) - look.inside) * Math.min(1, dt * INSIDE.ease);
    W.renderer.toneMappingExposure = base.exposure + (INSIDE.exposure - base.exposure) * look.inside;
    if (W.scene.fog) { W.scene.fog.near = base.fogNear + (INSIDE.fogNear - base.fogNear) * look.inside; W.scene.fog.far = base.fogFar + (INSIDE.fogFar - base.fogFar) * look.inside; }
    // the player lit by the cabin they are in (and by the station's rooms again once out: player.js's own check)
    if (player) {
      if (inShip && inShip.cabin?.env && player.cabin !== inShip) { player.cabin = inShip; player.zone = W.zoneAt(player.pos); if (player.c) shine(player.c, inShip.cabin.env); }
      else if (!inShip && player.cabin) { player.cabin = null; player.zone = null; }
    }
  }

  // (for the rigs: the middle of each of a ship's rooms on its deck, and where each way in meets the floor, in the
  // station's frame)
  function spots(id) {
    const s = ships.find((q) => q.id === id); if (!s || !s.bpData) return null;
    const rooms = {};
    for (const r of s.bpData.rooms) rooms[r.id] = new THREE.Vector3((r.rect[0] + r.rect[2]) / 2, s.space.deck + (r.floor || 0), (r.rect[1] + r.rect[3]) / 2).applyMatrix4(s.M).toArray().map((v) => +v.toFixed(3));
    // (and just inside each room's first door: a room whose middle is all fittings, a washroom, is walked to there)
    const doorIn = {};
    for (const d of s.bpData.doors || []) for (const id of d.rooms) {
      const r = s.bpData.rooms.find((q) => q.id === id); if (!r || doorIn[id]) continue;
      const [x0, z0, x1, z1] = r.rect, [x, z] = d.at, n = Math.abs(x - x0) < 1e-3 ? [1, 0] : Math.abs(x - x1) < 1e-3 ? [-1, 0] : Math.abs(z - z0) < 1e-3 ? [0, 1] : [0, -1];
      doorIn[id] = new THREE.Vector3(x + n[0] * 0.45, s.space.deck + (r.floor || 0), z + n[1] * 0.45).applyMatrix4(s.M).toArray().map((v) => +v.toFixed(3));
    }
    // (each way in: on the floor 2 m beyond the point it senses people from, out from the ship's middle: clear of a
    // ramp as it comes down)
    const r3 = (v) => v.toArray().map((u) => +u.toFixed(3));
    const mid = new THREE.Vector3(0, 0, 0).applyMatrix4(s.M0);
    const ways = s.ways.map((D) => { const dx = D.sense.x - mid.x, dz = D.sense.z - mid.z, L = Math.hypot(dx, dz) || 1; return r3(new THREE.Vector3(D.sense.x + dx / L * 2, 0, D.sense.z + dz / L * 2).applyMatrix4(s.D)); });
    // (a lift: its foot on the hangar floor beside it (the ship's frame's point, on the ground) as its way in; and the
    // middle of its tread up and down)
    for (const L of s.lifts) ways.push(r3(new THREE.Vector3(L.foot[0], 0, L.foot[1]).applyMatrix4(s.M).setY(0)));
    const lifts = s.lifts.filter((L) => L.box).map((L) => { const c = L.box.getCenter(new THREE.Vector3()); return { top: r3(c.clone().setY(L.top0).applyMatrix4(s.D)), bottom: r3(c.clone().setY(L.top0 - L.drop).applyMatrix4(s.D)), t: +L.D.t.toFixed(3) }; });
    return { rooms, doorIn, ways, lifts };
  }

  // (where a point is aboard: 'explorer/mess', or null)
  const where = (p) => { const s = inside(p); if (!s) return null; const r = roomOf(s, p); return s.id + '/' + (r ? r.id : '?'); };

  // A SHIP'S OWN CORE: the reactor in its engineering room, found by name in its blueprint (src/missions.js coreIn).
  // -> { room ('miner/engineering'), pos (where a person stands before it, on the nearest floor there), look (the
  // glowing core itself) }, in the station's frame, where the ship stands; null while its cabin is not in. (The
  // engineer's tuning of the core: src/tune.js.)
  function core(id) {
    const s = ships.find((q) => q.id === id); if (!s || s.state !== 'in' || !s.bpData || !s.M) return null;
    const C = coreIn(s.bpData); if (!C) return null;
    const deck = s.space.deck + C.floor, at = new THREE.Vector3(C.stand[0], deck, C.stand[1]).applyMatrix4(s.M);
    const pos = walls.snap(at.x, at.y + 0.25, at.z, 0.8, CABIN_WALLS.r) || at;
    return { room: s.id + '/' + C.room, pos: new THREE.Vector3(pos.x, pos.y, pos.z), look: new THREE.Vector3(C.look[0], deck + C.look[1], C.look[2]).applyMatrix4(s.M) };
  }

  // (a ship that is not parked yet, the Miner landing (src/crane.js): its cabin not loaded or drawn, its lift left as it
  // is, until it is down)
  function hold(id, on = true) { const s = ships.find((q) => q.id === id); if (s) s.held = !!on; return !!s; }
  // (a ship flown, src/flying.js: its cabin drawn where the ship is now. D: a Matrix4, from where it is parked to where it
  // is now; null: standing again. Where a person can walk stays where it stands: nobody walks about a ship in flight.)
  function fly(id, D) {
    const s = ships.find((q) => q.id === id); if (!s || !s.cabin) return false;
    if (!D) { s.flown = null; s.cabin.group.matrix.copy(s.M); }
    else { s.flown = s.flown || { M: new THREE.Matrix4(), inv: new THREE.Matrix4() }; s.flown.M.multiplyMatrices(D, s.M0); s.flown.inv.copy(s.flown.M).invert(); s.cabin.group.matrix.copy(s.flown.M); }
    s.cabin.group.matrixWorldNeedsUpdate = true;
    return true;
  }
  // A SHIP STOOD WHERE IT WAS SET DOWN (the top of this file). D: from where it is parked to where it stands; null: its
  // proper parking place. Its hull and legs (the station's own room of it: walls.js `apart`), its cabin, its lift.
  function stand(id, D = null) {
    const s = ships.find((q) => q.id === id); if (!s) return false;
    if (D) s.D.copy(D); else s.D.identity();
    s.Di.copy(s.D).invert(); s.moved = !!D; s.flown = null;
    const at = s.moved ? s.D : null;
    walls.place('room:' + s.zone.id, at);
    // (its ways in, shut: each door's own box, kept where the ship is parked, is asked where the ship stands)
    const fr = s.moved ? frameOf(s.D.elements) : null; for (const e of s.entries) e.fr = fr;
    if (s.M0) {
      s.M.multiplyMatrices(s.D, s.M0); s.inv.copy(s.M).invert();
      if (s.cabin) { s.cabin.group.matrix.copy(s.M); s.cabin.group.matrixWorldNeedsUpdate = true; }
      walls.place('cabin:' + s.id, at);
      for (const k of s.wayParts.keys()) walls.place(k, at);
    }
    poolKey = null; stands++;
    return true;
  }
  return { ships, update, inside, where, core, look, spots, hold, fly, stand, get stands() { return stands; }, stats: () => ships.map((s) => ({ id: s.id, state: s.state, held: !!s.held, moved: s.moved, ...(s.stats || {}) })) };
}
