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
//
// HOW (nothing here knows a coordinate: ships, rooms and doors are found by name in the station file):
//   - Each ship parked in the station is a room of the station file ('ship-explorer', drawn with its hangar). Its cabin
//     is built only while someone is in that hangar or the way into it (each cabin is about 80-110k triangles), by the
//     kit's own cabin code (kit/ships/cabin-room.js, as the Ship Lab builds it), placed where the ship is parked.
//   - The cabin's walls, floors and furniture are added to where a person can walk (walls.add, from the cabin as built),
//     and so are the ship's ways in, each a door of the ship that comes down to the floor (its stair or ramp), once it
//     is down: up its treads into the ship.
//   - The ways in open as a person comes near, only while the cabin is in (otherwise there is nothing behind them),
//     and close behind; the cabin's own sliding doors open as the station's do.
//   - Inside, the light is the Ship Lab's: the cabin's own baked strips and the beams of dusty light, the picture a
//     little brighter (the lab's exposure) and the station's haze held off; the station's saved light outside is as it
//     was.
import * as THREE from 'three';
import { updateDoors } from '../kit/layout.js';
import { placeMatrix } from '../kit/grid.js';
import { makeBeams } from '../kit/beams.js';
import { cabinMaterials } from '../kit/ships/cabin-built.js';
import { buildCabinRoom } from '../kit/ships/cabin-room.js';
import { liveTick, livePalette, FLICKER_TAG } from '../kit/shipparts/cabin/live.js';
import { corePulse, CORE_LOOK } from '../kit/shipparts/cabin/livecore.js';
import { CORE_TAG } from '../kit/shipparts/cabin/reactor.js';
import * as EB from '../kit/ships/explorer-built.js';
import { shine } from './player.js';

// THE SHIPS THAT CAN BE BOARDED: the station file's room for each parked ship, its module (its LAB says how its cabin
// meets its hull: kit/ships/<ship>-built.js), the blueprint the game's maker picked, and its ways in (the ship's
// doors that come down to the floor, by piece; `step`: what the ship's module does each frame to pose them, as the
// Medic's ramp unfolds its foot). (The Miner has blueprints but no cabin built in the Ship Lab yet, and the Hauler is
// paused: neither is boarded.)
export const SHIPS = [
  { id: 'explorer', zone: 'ship-explorer', lab: EB.LAB, bp: 'explorer-c-row', ways: ['ebAirstair'] },
];
// how near (m, along the floor) a person must be to a way in for it to come down (the door's own reach, if it has one);
// how long (s) after everyone has left a ship's hangar its cabin is dropped; the cabin's look
export const NEAR = 4.5, LINGER = 4, LOOK = 'light';
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
    for (const e of entries) e.locked = true;
    ships.push({ ...S, zd, zone, hangar, near, ways, entries, state: 'out', away: 0, cabin: null, wayParts: new Map(), M: null, inv: null, stats: null });
  }

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
      // at the space's deck, as the Ship Lab builds it)
      const pl = s.zd.pieces[0], off = pl.off || [0, 0, 0];
      s.M = placeMatrix({ ...pl, off: [off[0], off[1] - space.deck, off[2]] }, new THREE.Matrix4());
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
      // where a person can walk: its walls, floors and furniture, and its doors, in the station's frame
      t = performance.now();
      const solid = [], up = [], doors = [], _b = new THREE.Box3(), _m = new THREE.Matrix4();
      for (const z of C.built.zones) for (const k of ['solid', 'floor', 'glass']) {
        const g = z.merged[k]; if (!g) continue;
        const w = new THREE.BufferGeometry(); w.setAttribute('position', g.attributes.position.clone()); w.setIndex(g.index); w.applyMatrix4(s.M);
        solid.push(w); if (k !== 'glass') up.push(w);
      }
      for (const D of C.built.doors) {
        const box = new THREE.Box3();
        for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); box.union(_b.copy(im.geometry.boundingBox).applyMatrix4(_m.copy(leaf.M).multiply(leaf.base))); }
        if (!box.isEmpty()) doors.push({ D, box: box.applyMatrix4(s.M) });
        D.senseW = D.sense.clone().applyMatrix4(s.M);
      }
      walls.add('cabin:' + s.id, { solid, up, doors, voxel: CABIN_WALLS.voxel, r: CABIN_WALLS.r });
      times.walls = Math.round(performance.now() - t);
      W.scene.add(group);
      // (its materials' programs made now, not on the first frame it is seen)
      t = performance.now();
      if (W.renderer.compileAsync) await W.renderer.compileAsync(group, W.camera); else W.renderer.compile(group, W.camera);
      times.compile = Math.round(performance.now() - t);
      if (s.state !== 'loading') { W.scene.remove(group); walls.drop('cabin:' + s.id); C.built.dispose(); beams?.dispose(); return; }
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
    for (const e of s.entries) e.locked = true;
    s.cabin = null; s.state = 'out'; poolKey = null;
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
    W.built.group.visible = false; W.sky.object.visible = false;
    cc.update(W.renderer, W.scene);
    W.built.group.visible = shown; W.sky.object.visible = sky; W.scene.remove(cc);
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
    walls.add(key, { solid: geos, up: geos, when: (pathing) => (pathing ? s.state === 'in' : D.t > 0.97) });
    s.wayParts.set(key, D);
  }

  // the room of a ship's cabin a point is in (its blueprint's room), or null
  function roomOf(s, p) {
    _p.copy(p).applyMatrix4(s.inv);
    return s.bpData.rooms.find((r) => _p.x >= r.rect[0] && _p.x <= r.rect[2] && _p.z >= r.rect[1] && _p.z <= r.rect[3]) || null;
  }
  // which ship's cabin a point is in (its rooms, deck to ceiling)
  const _p = new THREE.Vector3();
  function inside(p) {
    for (const s of ships) {
      if (s.state !== 'in') continue;
      _p.copy(p).applyMatrix4(s.inv);
      const y = _p.y - s.space.deck; if (y < -0.4 || y > 3.4) continue;
      if (s.bpData.rooms.some((r) => _p.x >= r.rect[0] - 0.1 && _p.x <= r.rect[2] + 0.1 && _p.z >= r.rect[1] - 0.1 && _p.z <= r.rect[3] + 0.1)) return s;
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
      if (near && s.state === 'out') load(s);
      else if (!near && s.away > LINGER && (s.state === 'in' || s.state === 'loading')) drop(s);
      // the ways in: down for anyone near them while the cabin is in, up otherwise
      s.ways.forEach((D, i) => {
        let open = false;
        if (s.state === 'in') {
          const reach = D.near || NEAR;
          for (const e of eyes) if (Math.hypot(e.x - D.sense.x, e.z - D.sense.z) < reach && Math.abs(e.y - D.sense.y) < 3) { open = true; break; }
        }
        ONE[0] = D; updateDoors(ONE, FAR, dt, open ? 'open' : 'shut');
        if (D.t >= 1 && s.state === 'in') wayDown(s, D, i);
      });
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
      c.group.visible = s.zone.group.visible || inShip === s;
      c.beams?.update(W.dust ? performance.now() / 1000 : 0);
    }
    const now = performance.now() / 1000, flick = liveTick(now), core = corePulse(now, CORE_LOOK);
    // the pools of the room the camera is in
    if (pools.length) {
      const cs = inside(camera.position), r = cs ? roomOf(cs, camera.position) : null, key = cs && r ? cs.id + '|' + r.id : null;
      if (key !== poolKey) {
        poolKey = key;
        const mine = r ? (cs.cabin.C.parts.pools || []).filter((p) => p.room === r.id).sort((a, b) => b.i - a.i).slice(0, POOL_N) : [];
        pools.forEach((L, i) => { const p = mine[i]; L.userData.pool = p || null; L.intensity = p ? p.i : 0; if (!p) return; L.position.set(p.at[0], p.at[1] + cs.space.deck, p.at[2]).applyMatrix4(cs.M); L.color.setRGB(...p.color); L.distance = p.reach; });
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
      if (inShip && inShip.cabin?.env && player.cabin !== inShip) { player.cabin = inShip; player.zone = W.zoneAt(player.pos); shine(player.c, inShip.cabin.env); }
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
    return { rooms, doorIn, ways: s.ways.map((D) => [+D.sense.x.toFixed(3), 0, +D.sense.z.toFixed(3)]) };
  }

  // (where a point is aboard: 'explorer/mess', or null)
  const where = (p) => { const s = inside(p); if (!s) return null; const r = roomOf(s, p); return s.id + '/' + (r ? r.id : '?'); };

  return { ships, update, inside, where, look, spots, stats: () => ships.map((s) => ({ id: s.id, state: s.state, ...(s.stats || {}) })) };
}
