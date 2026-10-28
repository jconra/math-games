// THE TOWN'S PEOPLE: the townsfolk going about the town. Each has a home (src/townpeopleplan.js): the homes behind the
// main row, the rooms over the saloon or the store, or a place up the road. They come out of doors, walk the town's paths
// to the places people gather (the saloon's porch, the store's, the stable yard, the square, the crowd in front of the
// stage while the band plays, the lake shore down the path behind the saloon, the homes' lane and yards), stand about a while (talking, when someone else
// is there), and go in again: home, or into the store or the saloon. Most go home at night (W.night, from the world's
// day and night; none of it if the world has no night), and their windows light up.
//
// NOBODY POPS IN OR OUT IN VIEW. A person comes out of a door (they dissolve in at the foot of the steps over half a
// second and walk out: folk.js fade) or, coming into town from up the road, from a road's end out of sight; and goes in
// through a door (dissolving as they step in) or off up the road, gone only once out of sight (a road's end in view:
// they walk on until it isn't). People about town by day prefer a door the player isn't looking at. "Out of sight" is
// outside the camera's view (with a margin), behind a building, or far off (TOWN.seenFar). Every appearing and going is
// logged (TP.log) with whether it was in sight, for the rigs.
//
// THE JOBS' PEOPLE are the same townsfolk. A job that needs someone (a customer for the store's counter, a family come
// for its stolen goods at the sheriff's office) borrows them: TP.lend picks whoever is best placed (out and close, or
// indoors near the job: they come out of the nearest door), and hands over their body and the way to walk; the job moves
// them; TP.giveBack takes them back where they stand, and they walk on (home, or about the town). Jobs that see the need
// coming say so first (TP.expect): the player riding toward the sheriff's office with the loot, or walking up to the
// store, and the people the job will want start walking there already, so nobody waits.
//
// HOWDY: a person the player comes close to says hello in a little bubble (src/ui/howdy.js).
//
//   addHomes(W)          once the world is made, before the player: the homes (layout.json kind 'home') as W.places.homes
//                        [{ id, x, z, rot, w, d, h, door, kind }], and added to W.places.buildings (the camera keeps out of
//                        them); returns the list
//   const TP = makeTownPeople({ W, folk, camera, player, jobs, scene })
//     player(): the player (P) or null; jobs: { store(), loot(), stage() } getters (or missing): the store's counter job
//     (src/missions/store.js), the loot job (src/missions/loot.js: its LJ.wanted()), the stage (S.state().playing)
//   TP.update(dt, { hidden })   each frame of play (hidden: a panel or the cabin is up: nothing moves)
//   TP.people           the townsfolk: { name, who (the FOLK entry), home, p (the body, once made), x, z, state, out, lent }
//   TP.doors, TP.spots, TP.edges   the node system: the doors (each building's and home's: its spot on the ground in
//                        front of the steps, and the foot of the steps), the places people gather, the roads' ends
//   TP.lend({ to, names, hurry }) -> rec | null   someone for a job, walking toward `to` ({ x, z }): one of `names` (FOLK
//                        names; any townsperson if left out). rec: { who, name, p, x, z, yaw, via: [{ x, z }, ...] (the way
//                        to walk first, then the job's own target), lent: true }. The job moves rec.x / rec.z / rec.yaw and
//                        the body; TP still fades them in when they have just stepped out of a door
//   TP.giveBack(rec)     the job is done with them (never removed: they walk on)
//   TP.expect({ key, to, names, n })   a job will want n of `names` at `to` soon: they start walking there now
//   TP.windows(night, dt)   the homes' lamps (W.lights, world/objects/nightLights.js): lit in the homes somebody is in,
//                        out in the others; TP.update does it each frame; TP.lit(id) how lit now
//   TP.log               [{ t, name, ev: 'appear' | 'vanish', how: 'door' | 'road' | 'start' | 'fade', seen, x, z }]
//   TP.state()           for rigs: everyone's state, place, fade and whether they are drawn
//   TP.laneSpot()        the middle of the homes' lane (a dev spot); TP.dockSpot() the shore spot at the dock path's end
//   TP.way(from, to)     for rigs: the way a townsperson would walk between two spots ([{ x, z }, ...]; [] if none)
//   TP.dispose()
import * as THREE from 'three';
import { makePerson } from './actors/folk.js';
import { gridSteps, route as findRoute, along, cellAt, openAt, shut, reopen, reopenSome, makeRoute, COST } from './townpaths.js';
import { TOWN, HOME_OF, residents, nextFor, STAY, outCap, lendCost } from './townpeopleplan.js';
import { howdy, makeHowdyWatch } from './ui/howdy.js';
import { wagonAt, roadCurve, WAGONS_OUT } from './wagon.js';
import { modelFootprint } from '../world/objects/townAssets.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnTo = (a, b, max) => a + Math.max(-max, Math.min(max, wrapA(b - a)));

// ── THE HOMES ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function addHomes(W) {
  if (W.places.homes) return W.places.homes;
  const items = (W.V && W.V.TOWN && W.V.TOWN.village && W.V.TOWN.village.layout.items) || [];
  const homes = [];
  for (const it of items) {
    if (it.type !== 'model' || it.kind !== 'home') continue;
    const { w, d, h } = modelFootprint(it), rot = it.rot * Math.PI / 180, s = Math.sin(rot), c = Math.cos(rot), out = d / 2 + 1.5;
    homes.push({ id: it.id, kind: 'home', x: it.x, z: it.z, rot, w, d, h, size: Math.max(w, d), door: { x: it.x + s * out, z: it.z + c * out } });
  }
  Object.defineProperty(W.places, 'homes', { value: homes, enumerable: false });
  if (Array.isArray(W.places.buildings)) for (const hm of homes) if (!W.places.buildings.includes(hm)) W.places.buildings.push(hm);
  return homes;
}

export function makeTownPeople({ W, folk, camera, player = () => null, jobs = {}, scene = W.scene }) {
  const job = (k) => { try { return jobs[k] ? jobs[k]() : null; } catch (e) { return null; } };
  const tier = W.tier || 'normal', shadows = tier !== 'potato' && !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  // how many may be out at once: the tier's (src/townpeopleplan.js TOWN.out), or the governor's 'townsfolk' dial, live
  // (world/governor.js): turned down, the extra ones go home in their own time
  let outMost = tier;
  const offGov = W.governor ? W.governor.on('townsfolk', (v) => { outMost = v; }) : null;
  const P = W.places, homes = addHomes(W);
  for (const hm of homes) hm.y0 = W.heightAt(hm.x, hm.z);
  const TP = { people: [], doors: [], spots: [], edges: [], log: [], expecting: new Map() };
  const t0 = performance.now(), now = () => (performance.now() - t0) / 1000;

  // ── THE NODES ────────────────────────────────────────────────────────────────────────────────────────────────────
  const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.25;
  // the wagons' road through the valley (src/wagon.js roadCurve): its middle every metre, so the places people stand
  // about keep clear of it (TOWN.road)
  const roadPts = [];
  try { const rc = roadCurve(W, 'through'), L = rc.getLength(), q = new THREE.Vector3(); for (let s = 0; s <= L; s += 1) { rc.getPointAt(s / L, q); roadPts.push(q.x, q.z); } } catch (e) { /* (no road: nothing to keep clear of) */ }
  const roadGap = (x, z) => { let best = Infinity; for (let i = 0; i < roadPts.length; i += 2) { const dx = x - roadPts[i], dz = z - roadPts[i + 1], d = dx * dx + dz * dz; if (d < best) best = d; } return Math.sqrt(best); };
  const clearOfRoad = (x, z) => roadGap(x, z) >= TOWN.road;
  const frame = (b) => ({ o: { x: Math.sin(b.rot), z: Math.cos(b.rot) }, s: { x: Math.cos(b.rot), z: -Math.sin(b.rot) } });
  // doors: in front of the steps, and the foot of the steps (a metre in) where the dissolve starts
  for (const [id, b] of [['store', P.store], ['saloon', P.saloon], ['sheriff', P.sheriff], ['stable', P.stable], ...homes.map((h) => [h.id, h])]) {
    if (!b || !b.door) continue;
    const { o } = frame(b);
    TP.doors.push({ id, item: b.id || id, kind: 'door', x: b.door.x, z: b.door.z, face: b.rot, step: { x: b.door.x - o.x * TOWN.doorStep, z: b.door.z - o.z * TOWN.doorStep }, home: /^home/.test(id) ? id : null });
  }
  // a code-built building's doors are real (world/objects/doorkeeper.js): its door's spot just outside its doorway and
  // the step just inside it, and they push the door open going through (once the buildings are made)
  const CODE = W.V && W.V.CODE;
  const fitDoors = () => {
    if (!CODE || !CODE.entrance) return;
    for (const d of TP.doors) {
      const e = CODE.entrance(d.item); if (!e) continue;
      Object.assign(d, { x: e.x + e.ox * TOWN.doorOut, z: e.z + e.oz * TOWN.doorOut, face: Math.atan2(e.ox, e.oz), step: { x: e.x - e.ox * TOWN.doorIn, z: e.z - e.oz * TOWN.doorIn }, code: { x: e.x, z: e.z } });
    }
  };
  fitDoors(); if (CODE && CODE.ready) CODE.ready.then(fitDoors);
  const push = (d) => { if (d && d.code && CODE && CODE.doors) CODE.doors.pass(d.code.x, d.code.z, TOWN.doorWalk + 0.4); };
  const doorOf = (id) => TP.doors.find((d) => d.id === id) || null;
  const nearDoor = (x, z, d) => TP.doors.some((q) => Math.hypot(q.x - x, q.z - z) < d);
  // the places people gather
  // (keep: how far from the road's middle; a porch's people stand along the building's front, the second a step along
  // it, never out toward the road: TOWN.porchRoad there. The shops and the stable face the main street with the wagon
  // road a few metres out, so each spot below has a few places to try, nearest the old one first)
  const spot = (id, kind, x, z, face, cap, extra = {}, keep = TOWN.road) => {
    if (!free(x, z) || nearDoor(x, z, 2.2) || roadGap(x, z) < keep) return null;
    const s = { id, kind, x, z, face, cap, used: 0, taken: [], crowd: 0, ...extra }; TP.spots.push(s); return s;
  };
  if (P.saloon) { const { o, s } = frame(P.saloon); for (const k of [1, -1]) { let made = null; for (const out of [1.6, 0.8]) if (!made) made = spot('saloon-porch-' + (k > 0 ? 'a' : 'b'), 'porch', P.saloon.door.x + o.x * out + s.x * 3.4 * k, P.saloon.door.z + o.z * out + s.z * 3.4 * k, P.saloon.rot, 2, {}, TOWN.porchRoad); } }
  if (P.store) {   // (the side away from the counter's customers first: they queue on the store's other side, STORE.queue's -1;
                   // the street bends in close to the store's front at that end, and the spot was made out in the road there)
    const { o, s } = frame(P.store); let made = null;
    for (const k of [-1, 1]) for (const out of [1, 2, 0, -0.7]) if (!made) made = spot('store-porch', 'porch', P.store.door.x + o.x * out + s.x * 4.6 * k, P.store.door.z + o.z * out + s.z * 4.6 * k, P.store.rot, 2, {}, TOWN.porchRoad);
  }
  if (P.stable) {   // (out in front of its big doors; else the yard beside it, the far side from its door's keeper first)
    const { o, s } = frame(P.stable); let made = null;
    for (const [out, side, face] of [[6, 1.5, Math.PI], [-4.5, 9.5, 0], [-4.5, -9.5, 0]]) if (!made) made = spot('stable-yard', 'yard', P.stable.door.x + o.x * out + s.x * side, P.stable.door.z + o.z * out + s.z * side, P.stable.rot + face, 3);
  }
  if (P.square) {   // (two places round its edge: either side of the way to the cabin, else further round)
    const sq = P.square, toCab = P.cabin ? Math.atan2(P.cabin.x - sq.x, P.cabin.z - sq.z) : 0;
    let i = 0;
    for (const a of [toCab + 0.5, toCab - 1.4, toCab + 1.5, toCab - 0.6, toCab + 2.5, toCab - 2.4, toCab + Math.PI]) { if (i >= 2) break; const x = sq.x + Math.sin(a) * sq.r * 0.72, z = sq.z + Math.cos(a) * sq.r * 0.72; if (spot('square-' + i, 'square', x, z, Math.atan2(sq.x - x, sq.z - z), 2)) i++; }
  }
  if (P.stage && P.stage.crowd) { const c = P.stage.crowd; spot('stage-crowd', 'stage', c.x, c.z, Math.atan2(P.stage.x - c.x, P.stage.z - c.z), 4, { r: c.r }); }
  if (homes.length) {
    // the lane: the middle of the homes people live in (a house put down elsewhere in the town, nobody's, doesn't pull it
    // off their lane)
    const lived = new Set(Object.values(HOME_OF)), lane = homes.some((h) => lived.has(h.id)) ? homes.filter((h) => lived.has(h.id)) : homes;
    const mid = { x: lane.reduce((a, h) => a + h.door.x, 0) / lane.length, z: lane.reduce((a, h) => a + h.door.z, 0) / lane.length };
    TP.lane = mid;
    spot('lane', 'lane', mid.x, mid.z, Math.PI, 2);
    for (const hm of homes) { const { o, s } = frame(hm); spot(hm.id + '-yard', 'home', hm.door.x + o.x * 0.6 + s.x * 2.6, hm.door.z + o.z * 0.6 + s.z * 2.6, hm.rot, 2, { home: hm.id }); }
    // the lake shore beyond the lane (the water found by walking on from the lane's middle, away from the town)
    const sq = P.square || P.spawn, away = Math.atan2(mid.x - sq.x, mid.z - sq.z);
    for (let d = 4; d < 70; d += 1) {
      const x = mid.x + Math.sin(away) * d, z = mid.z + Math.cos(away) * d;
      if (W.waterAt(x, z) > 0.3) { const bx = mid.x + Math.sin(away) * (d - 4), bz = mid.z + Math.cos(away) * (d - 4); spot('lake', 'lake', bx, bz, away, 2); break; }
    }
  }
  // the path to the lake behind the saloon (the planting's 'dockpath', down to where the fishing dock is to go): a spot on
  // the shore at its end, a step to one side so the dock's own spot stays clear, facing out over the water
  { const st = ((W.V && W.V.PLANTING_FIRST && W.V.PLANTING_FIRST.strokes) || []).find((q) => q.id === 'dockpath'), p = st && st.pts;
    if (p && p.length > 1) {
      const [ex, ez] = p[p.length - 1], [qx, qz] = p[p.length - 2], l = Math.hypot(ex - qx, ez - qz) || 1, ux = (ex - qx) / l, uz = (ez - qz) / l;
      let made = null;
      for (let back = 0; back <= 5 && !made; back++) for (const k of [2.8, -2.8]) if (!made) made = spot('dock', 'lake', ex - ux * back + uz * k, ez - uz * back - ux * k, Math.atan2(ux, uz), 2);
    } }
  // the roads' ends: where people come into town from up the road and go off up it (only ever out of sight)
  const roadEnd = (id, x, z, dir) => { if (free(x, z)) TP.edges.push({ id, kind: 'edge', x, z, dir }); };
  { const sq = P.square || P.spawn, y = sq.z; roadEnd('west', sq.x - 75, y + 2, { x: -1, z: 0.04 }); roadEnd('east', sq.x + 58, y + 1, { x: 1, z: 0.02 }); }

  // ── THE WALKING GRID (laid a few milliseconds a frame) ───────────────────────────────────────────────────────────
  const xs = [...TP.doors.map((d) => d.x), ...TP.spots.map((s) => s.x), ...TP.edges.map((e) => e.x)], zs = [...TP.doors.map((d) => d.z), ...TP.spots.map((s) => s.z), ...TP.edges.map((e) => e.z)];
  const box = { x0: Math.min(...xs) - 18, x1: Math.max(...xs) + 18, z0: Math.min(...zs) - 18, z1: Math.max(...zs) + 18 };
  // the dirt: the planting's paths (the square, the trail, the stable's walk ...): their strokes' radius x 0.55 is metres
  const dirt = ((W.V && W.V.PLANTING_FIRST && W.V.PLANTING_FIRST.strokes) || []).filter((st) => st.kind === 25 && st.mode !== 'clear').map((st) => ({ r: (st.r || 2) * 0.55, pts: st.pts }));
  const onDirt = (x, z) => { for (const d of dirt) { const p = d.pts; if (p.length === 1) { if (Math.hypot(x - p[0][0], z - p[0][1]) < d.r) return true; continue; }
    for (let i = 1; i < p.length; i++) { const ax = p[i - 1][0], az = p[i - 1][1], vx = p[i][0] - ax, vz = p[i][1] - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); if (Math.hypot(ax + vx * t - x, az + vz * t - z) < d.r) return true; } } return false; };
  let townBlock = false;   // (the town's own people don't count as walls in the grid)
  const ground = (x, z) => { townBlock = true; const b = W.blocked(x, z); townBlock = false; if (b) return 0; const wet = W.waterAt(x, z), path = onDirt(x, z); if (wet > 0.25 && !(path && wet < 0.7)) return 0; return path ? COST.ROAD : COST.GRASS; };
  let G = null; const laying = gridSteps({ ...box, cell: 1, ground });
  function layGrid(ms) { if (G) return; const a = performance.now(); while (performance.now() - a < ms) { const r = laying.next(); if (r.done) { G = r.value; for (const s of TP.spots) if (cellAt(G, s.x, s.z) < 0 || !G.cost[cellAt(G, s.x, s.z)]) s.cap = 0; TP.gridMs = performance.now() - t0; return; } } }
  // routes: kept for each pair of nodes (a door, a spot, an edge); from anywhere else worked out fresh
  const routes = new Map(), queue = [];
  function ask(from, to, done, key = null) { if (key && routes.has(key)) { done(routes.get(key)); return; } queue.push({ from, to, done, key }); }
  function routeStep() {
    for (let n = 0; n < TOWN.routesPerFrame && queue.length && G; n++) {
      const q = queue.shift(); let r = findRoute(G, q.from, q.to);
      if (!r) r = makeRoute(Float32Array.from([q.from.x, q.from.z, q.to.x, q.to.z]));   // (no way found: straight, and the
      if (q.key) routes.set(q.key, r);                                                  //  walker's own checks stop it at a wall)
      q.done(r);
    }
  }

  // ── IN SIGHT? (the camera's view, a margin round the person, buildings in between, far off) ─────────────────────
  const fr = new THREE.Frustum(), M = new THREE.Matrix4(), S = new THREE.Sphere();
  const B = (P.buildings || []).filter((b) => b && b.w).map((b) => ({ x: b.x, z: b.z, c: Math.cos(b.rot), s: Math.sin(b.rot), hw: b.w / 2 - 0.3, hd: b.d / 2 - 0.3, y: W.heightAt(b.x, b.z) + (b.h || 6) * 0.8 }));
  function view() { camera.updateMatrixWorld(); M.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(M); }
  // does the line from the camera to (x, y, z) pass through a building (its box, up to most of its height)?
  function behind(x, y, z) {
    const c = camera.position;
    for (const b of B) {
      const ax = b.c * (c.x - b.x) - b.s * (c.z - b.z), az = b.s * (c.x - b.x) + b.c * (c.z - b.z), bx = b.c * (x - b.x) - b.s * (z - b.z), bz = b.s * (x - b.x) + b.c * (z - b.z);
      let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
      for (const [p, d, h] of [[ax, dx, b.hw], [az, dz, b.hd]]) { if (Math.abs(d) < 1e-9) { if (Math.abs(p) > h) { t0 = 2; break; } continue; } let u = (-h - p) / d, v = (h - p) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); }
      if (t0 < t1) { const ym = c.y + (y - c.y) * (t0 + t1) / 2; if (ym < b.y) return true; }
    }
    return false;
  }
  function seen(x, z, y = W.heightAt(x, z)) {
    const c = camera.position, d = Math.hypot(x - c.x, z - c.z);
    if (d > TOWN.seenFar) return false;
    S.center.set(x, y + 0.9, z); S.radius = TOWN.seenPad;
    if (!fr.intersectsSphere(S)) return false;
    if (d > 6 && behind(x, y + 1.85, z) && behind(x, y + 0.2, z)) return false;
    return true;
  }
  TP.seen = (x, z) => { view(); return seen(x, z); };

  // ── THE PEOPLE ───────────────────────────────────────────────────────────────────────────────────────────────────
  const R = residents();
  for (const r of R) TP.people.push({ ...r, p: null, x: 0, z: 0, y: 0, yaw: 0, state: 'inside', out: false, lent: false, in: r.home, until: rnd(5, 40), fade: 1,
    speed: rnd(TOWN.walk[0], TOWN.walk[1]), route: null, s: 0, seg: 0, lane: 0, push: 0, goal: null, at: null, slot: -1, wait: 0, watch: makeHowdyWatch(), clip: '', anim: 0, near: false });
  const byName = (n) => TP.people.find((q) => q.name === n) || null;
  function body(r) {
    if (r.p) return r.p;
    try { r.p = makePerson(folk, { ...r.look, shadows }); } catch (e) { console.warn('town people: a person could not be made', r.name, e); return null; }
    r.p.mesh.raycast = () => {};
    r.p.root.visible = false; scene.add(r.p.root);
    return r.p;
  }
  // (dissolve: the person faded in or out over TOWN.door seconds, through a door: never a pop, even in sight)
  function log(r, ev, how, seenNow) { TP.log.push({ t: +now().toFixed(2), name: r.name, ev, how, seen: !!seenNow, dissolve: how === 'door' || how === 'fade', x: +r.x.toFixed(1), z: +r.z.toFixed(1) }); if (TP.log.length > 400) TP.log.splice(0, 100); }
  function play(r, clip, opts) { if (r.p && r.clip !== clip) { r.p.play(clip, opts); r.clip = clip; } else if (r.p && opts && opts.speed) r.p.play(clip, opts); }
  const walkSpeed = (r, clip) => (clip === 'Run' ? TOWN.hurry : r.speed) / ((r.p && r.p.stride && r.p.stride[clip]) || 1.2);
  function placeBody(r) { if (!r.p) return; r.p.root.position.set(r.x, r.y, r.z); r.p.root.rotation.y = r.yaw; }
  // out of the nearest door to (x, z) (or this door), dissolving in at the foot of its steps
  function emerge(r, door, why = 'door') {
    if (!body(r)) return false;
    r.x = door.step.x; r.z = door.step.z; r.y = W.heightAt(r.x, r.z); r.yaw = door.face; r.out = true; r.state = 'appear'; r.t = 0; r.fade = 0;
    r.p.fade = 0; r.p.root.visible = true; play(r, 'Walk', { fade: 0, speed: walkSpeed(r, 'Walk') }); placeBody(r);
    r.door = door; door.busy = now() + 1.1; view(); log(r, 'appear', why, seen(door.x, door.z));
    push(door);   // (a real door: pushed open from inside)
    return true;
  }
  function fromRoad(r, edge) {
    if (!body(r)) return false;
    r.x = edge.x; r.z = edge.z; r.y = W.heightAt(r.x, r.z); r.yaw = Math.atan2(-edge.dir.x, -edge.dir.z); r.out = true; r.fade = 1; r.p.fade = 1; r.p.root.visible = true;
    placeBody(r); log(r, 'appear', 'road', false); think(r); return true;
  }
  function goInside(r, where, how) {
    view(); log(r, 'vanish', how, !!(r.p && r.p.root.visible) && seen(r.x, r.z, r.y));
    release(r); r.out = false; r.state = 'inside'; r.in = where; r.route = null; r.goal = null; if (r.p) { r.p.root.visible = false; r.p.fade = 1; } r.fade = 1;
    const n = night(); r.until = n > 0.5 ? rnd(TOWN.insideNight[0], TOWN.insideNight[1]) : rnd(TOWN.inside[0], TOWN.inside[1]);
  }
  const night = () => { const n = +W.night; return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; };
  // a spot's place for its slot q: the spot itself, then a step to one side, the other, and so on (the stage's crowd in
  // a little arc)
  function slotAt(s, q) {
    if (q === 0) return { x: s.x, z: s.z };
    const side = q % 2 ? 1 : -1, k = Math.ceil(q / 2), r = s.kind === 'stage' ? 1.3 : 1.1;
    const x = s.x + Math.cos(s.face) * side * r * k - Math.sin(s.face) * (s.kind === 'stage' ? 0.4 * k : 0), z = s.z - Math.sin(s.face) * side * r * k - Math.cos(s.face) * (s.kind === 'stage' ? 0.4 * k : 0);
    return { x, z };
  }
  function take(r, s) { let q = 0; while (s.taken[q]) q++; s.taken[q] = r; s.used++; r.at = s; r.slot = q; return slotAt(s, q); }
  function release(r) { const s = r.at; if (!s) return; s.used = Math.max(0, s.used - 1); if (s.taken[r.slot] === r) s.taken[r.slot] = null; r.at = null; r.slot = -1; }
  const outCount = () => TP.people.reduce((a, r) => a + (r.out ? 1 : 0), 0);

  // where next: a spot, home, a visit indoors, or off up the road (src/townpeopleplan.js nextFor)
  function think(r) {
    const stage = job('stage'), playing = !stage || !stage.state || stage.state().playing !== false;
    for (const s of TP.spots) s.crowd = s.used;
    const here = r.at; release(r);
    const n = night(), over = outCount() > outCap(outMost, n) + 1;
    const fresh = !!r.fresh; r.fresh = false;   // (just out of a door: not straight back in)
    const nx = over && !fresh ? { go: r.home === 'west' || r.home === 'east' ? 'road' : 'home' } : nextFor(r, TP.spots, { night: n, at: r, playing, here, fresh });
    let target = null, then = null;
    if (nx.go === 'spot') { const pt = take(r, nx.spot); target = pt; then = { kind: 'spot', spot: nx.spot }; }
    else if (nx.go === 'home' || nx.go === 'door') {
      const d = doorOf(nx.go === 'home' ? r.home : nx.door) || doorOf('saloon');
      if (d) { target = { x: d.x, z: d.z }; then = { kind: 'door', door: d }; }
    }
    if (!target) {   // (off up the road: their own road's end, else the nearer one)
      const near = TP.edges.slice().sort((a, b) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z))[0];
      const edge = TP.edges.find((q) => q.id === r.home) || near;
      if (!edge) { r.state = 'stay'; r.until = rnd(5, 10); return; }
      target = { x: edge.x, z: edge.z }; then = { kind: 'road', edge };
    }
    r.goal = then; r.state = 'plan'; play(r, 'Idle', { fade: 0.3 });
    const from = { x: r.x, z: r.z }, key = here ? here.id + '>' + (then.spot ? then.spot.id + ':' + r.slot : then.door ? then.door.id : then.edge.id) : null;
    ask(from, target, (rt) => { if (r.state !== 'plan' || r.goal !== then) return; startRoute(r, rt); }, key && Math.hypot(here.x - r.x, here.z - r.z) < 2.5 ? key : null);
  }
  function startRoute(r, rt, run = false) {
    // (from where they actually stand: a step onto the route's start)
    if (Math.hypot(rt.xz[0] - r.x, rt.xz[1] - r.z) > 0.05) { const xz = new Float32Array(rt.xz.length + 2); xz[0] = r.x; xz[1] = r.z; xz.set(rt.xz, 2); rt = makeRoute(xz); }
    r.route = rt; r.s = 0; r.seg = 0; r.state = 'walk'; r.lane = 0; r.run = run; r.stuck = 0;
    play(r, run ? 'Run' : 'Walk', { fade: 0.25, speed: walkSpeed(r, run ? 'Run' : 'Walk') });
  }
  function arrive(r) {
    const g = r.goal; r.route = null;
    if (!g) { r.state = 'stay'; r.until = rnd(4, 9); play(r, 'Idle', { fade: 0.3 }); return; }
    if (g.kind === 'door') { r.state = 'enter'; r.t = 0; r.door = g.door; push(g.door); play(r, 'Walk', { fade: 0.2, speed: walkSpeed(r, 'Walk') }); return; }
    if (g.kind === 'road') { r.state = 'away'; r.t = 0; r.edge = g.edge; return; }
    if (g.kind === 'wait') { r.state = 'stay'; r.until = 2; play(r, 'Idle', { fade: 0.3 }); return; }   // (an expected person: waits for the job)
    if (g.kind === 'aside') { r.goal = null; r.state = 'stay'; r.until = rnd(1.5, 4); play(r, 'Idle', { fade: 0.3 }); return; }   // (stepped out of a wagon's way)
    const s = g.spot, [clip, lo, hi] = STAY[s.kind] || ['Idle', 10, 30];
    r.state = 'stay'; r.until = rnd(lo, hi); r.want = s.face;
    // someone already there: the two face each other and talk a while; the one arriving waves
    const other = TP.people.find((o) => o !== r && o.out && !o.lent && o.state === 'stay' && o.at === s);
    if (other && Math.random() < 0.8 && s.kind !== 'stage') {
      r.want = Math.atan2(other.x - r.x, other.z - r.z); other.want = Math.atan2(r.x - other.x, r.z - other.z); other.until = Math.max(other.until, 8);
      play(r, 'Wave', { fade: 0.3, once: true }); r.clipT = 2.1; r.next = 'Idle';
    } else { play(r, clip === 'Idle' && Math.random() < 0.4 ? 'Idle_Neutral' : clip, { fade: 0.4 }); r.clipT = 0; }
  }

  // ── WAGONS WALKED ROUND ──────────────────────────────────────────────────────────────────────────────────────────
  // the squares shut round each wagon found standing in someone's way: { keys, x, z (where it stood) }. Once it has
  // rolled on (or been put away) they open again, and the routes worked out round it are worked out afresh
  const shutBy = new Map();
  let shutT = 0;
  function reopenMoved(dt) {
    if (!shutBy.size || !G || (shutT -= dt) > 0) return;
    shutT = 0.5;
    let opened = false;
    for (const [w, sh] of shutBy) {
      const gone = !w.boxes || !w.pos || !wagonAt(w.pos.x, w.pos.z, 0.5) || Math.hypot(w.pos.x - sh.x, w.pos.z - sh.z) > 1 || (w.pace > 0.15 && !w.standing) || (!w.standing && !w.parked);
      if (!gone) continue;
      reopenSome(G, sh.keys); shutBy.delete(w); opened = true;
    }
    if (opened) routes.clear();
  }

  // a wagon on the road stopped with its team's noses just short of r (not one standing at a spot or for good): it is
  // waiting on them. The wagon, or null
  function wagonWaiting(r) {
    for (const G of WAGONS_OUT) {
      if (G.standing || G.parked || !(G.pace < 0.05) || !G.front || !G.team || !G.team.length) continue;
      const dx = r.x - G.front.x, dz = r.z - G.front.z; if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
      const s = Math.sin(G.heading), c = Math.cos(G.heading), ahead = dx * s + dz * c, side = Math.abs(dx * c - dz * s);
      if (ahead > -0.5 && ahead < 5 && side < 2.2) return G;
    }
    return null;
  }
  // out of the way of the wagon G waiting on r: a few steps straight out to the side of its way they stand on (or the
  // other), then they stand a moment and go about their day. False: no room either side
  function stepAside(r, wg) {
    const s = Math.sin(wg.heading), c = Math.cos(wg.heading), k0 = ((r.x - wg.front.x) * c - (r.z - wg.front.z) * s) >= 0 ? 1 : -1;
    for (const k of [k0, -k0]) for (const d of TOWN.aside) {
      const x = r.x + c * k * d, z = r.z - s * k * d;
      if (!free(x, z) || wagonAt(x, z, 0.5) || (G && !openAt(G, x, z))) continue;
      release(r); r.goal = { kind: 'aside' }; startRoute(r, makeRoute(Float32Array.from([r.x, r.z, x, z])));
      return true;
    }
    return false;
  }

  // ── WALKING ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const Pt = { x: 0, z: 0, dx: 0, dz: 1, seg: 0 }, Qt = { x: 0, z: 0, dx: 0, dz: 1, seg: 0 };
  // what is just ahead of someone walking: the player (or the horse), another person, a wagon
  function blockedAhead(r, x, z, fx, fz) {
    const pl = player();
    if (pl && pl.position) {
      const dx = pl.position.x - x, dz = pl.position.z - z, d = Math.hypot(dx, dz), reach = TOWN.wait.player + (pl.onHorse ? 1.2 : 0);
      if (d < reach && (dx * fx + dz * fz) > 0.2 * d) return 'player';
      if (pl.horse && pl.horse.root && !pl.onHorse) { const h = pl.horse.root.position, hx = h.x - x, hz = h.z - z, hd = Math.hypot(hx, hz); if (hd < 1.9 && (hx * fx + hz * fz) > 0.3 * hd) return 'player'; }
    }
    for (const o of TP.people) { if (o === r || !o.out) continue; const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d < TOWN.wait.person && (dx * fx + dz * fz) > 0.5 * d && !(o.state === 'walk' && o.yaw !== undefined && Math.cos(o.yaw - r.yaw) > 0.5 && o.s > r.s)) return 'person'; }
    const G2 = wagonAt(x + fx * 1.2, z + fz * 1.2, 0.4);
    // (a wagon parked at its spot: walked round; one rolling: waited for; one only stopped in the road, which is
    // waiting for whoever is in its way, often this walker: treated as someone in the way, stepped aside from after a
    // moment. Walking round a stopped one re-planned for ever from inside the ground shut round it, both stuck for good)
    if (G2) return G2.standing || G2.parked ? 'stand' : G2.pace > 0.15 ? 'wagon' : 'stopped';
    return null;
  }
  function walk(r, dt) {
    const rt = r.route; if (!rt) { arrive(r); return; }
    along(rt, r.s, Pt, r.seg); r.seg = Pt.seg;
    const ahead = blockedAhead(r, r.x, r.z, Math.sin(r.yaw), Math.cos(r.yaw));
    if (ahead === 'stand' && G) {   // (a wagon standing in the way: round it)
      const W2 = wagonAt(r.x + Math.sin(r.yaw) * 1.2, r.z + Math.cos(r.yaw) * 1.2, 0.4);
      if (W2) {
        // (shut for as long as that wagon stands there: opened again once it has moved off or gone, round()
        // below; a wagon standing for good stays shut till the ride ends)
        let sh = shutBy.get(W2); if (!sh) shutBy.set(W2, sh = { keys: new Set(), x: W2.pos.x, z: W2.pos.z });
        for (const b of W2.boxes || []) shut(G, { x: b.x, z: b.z, w: b.hw * 2 + 0.6, d: b.hl * 2 + 0.6, rot: Math.atan2(b.s, b.c) }, sh.keys);
      }
      routes.clear(); const g = r.goal; const end = { x: rt.xz[rt.xz.length - 2], z: rt.xz[rt.xz.length - 1] };
      r.state = 'plan'; play(r, 'Idle', { fade: 0.3 }); ask({ x: r.x, z: r.z }, end, (nr) => { if (r.state === 'plan' && r.goal === g) startRoute(r, nr, r.run); });
      return;
    }
    if (ahead) {
      r.wait += dt;
      if (r.wait < 3 || ahead === 'wagon') { if (r.clip !== 'Idle') play(r, 'Idle', { fade: 0.3 }); r.push = Math.min(1.2, r.push + dt * 0.5); return; }
      r.push = Math.min(1.4, r.push + dt);   // (waited long enough: step aside and go on)
    } else { r.wait = 0; r.push = Math.max(0, r.push - dt * 0.3); }
    const clip = r.run ? 'Run' : 'Walk';
    if (r.clip !== clip) play(r, clip, { fade: 0.25, speed: walkSpeed(r, clip) });
    r.s += (r.run ? TOWN.hurry : r.speed) * dt;
    if (r.s >= rt.total) { r.x = rt.xz[rt.xz.length - 2]; r.z = rt.xz[rt.xz.length - 1]; arrive(r); return; }
    along(rt, r.s, Pt, r.seg); r.seg = Pt.seg;
    // keep to the right a little (more when someone is in the way), easing out near either end; never into a wall
    const ends = Math.min(1, r.s / 3, (rt.total - r.s) / 3), want = (0.35 + r.push) * Math.max(0, ends);
    const rx = -Pt.dz, rz = Pt.dx;
    const ok = G ? (() => { const k = cellAt(G, Pt.x + rx * (want + 0.3), Pt.z + rz * (want + 0.3)); return k >= 0 && G.cost[k] > 0; })() : true;
    r.lane += ((ok ? want : 0) - r.lane) * Math.min(1, dt * 2);
    r.x = Pt.x + rx * r.lane; r.z = Pt.z + rz * r.lane;
    along(rt, r.s + 1.2, Qt, r.seg);
    const ax = Qt.x + rx * r.lane - r.x, az = Qt.z + rz * r.lane - r.z;
    if (ax * ax + az * az > 1e-4) r.yaw = turnTo(r.yaw, Math.atan2(ax, az), dt * 5);
  }

  // ── THE JOBS' PEOPLE ─────────────────────────────────────────────────────────────────────────────────────────────
  // the best of `names` for a job at `to`: out and close, or indoors (out of the door nearest `to`)
  function best(names, to, { skip = null, notDoor = null } = {}) {
    let pick = null, cost = Infinity;
    // (the door nearest the job; one somebody stepped out of a moment ago counts as further: no two through it at once)
    const doorNear = TP.doors.filter((d) => d.id !== notDoor).map((d) => ({ d, k: Math.hypot(d.x - to.x, d.z - to.z) + ((d.busy || 0) > now() ? 12 : 0) })).sort((a, b) => a.k - b.k)[0];
    for (const r of TP.people) {
      if (r.lent || (names && !names.includes(r.name)) || (skip && skip(r))) continue;
      const c = r.out ? lendCost({ out: true, d: Math.hypot(r.x - to.x, r.z - to.z) + (r.state === 'enter' ? 4 : 0) }) : doorNear ? lendCost({ out: false, d: doorNear.k }) : Infinity;
      if (c < cost - 1e-6 || (Math.abs(c - cost) < 1e-6 && Math.random() < 0.5)) { cost = c; pick = r; }
    }
    return pick ? { r: pick, door: !pick.out ? doorNear && doorNear.d : null } : null;
  }
  // a route (or a straight line before the grid is laid) as points to walk, the last being `to` itself left off
  function viaPoints(from, to) {
    if (!G) return [];
    const rt = findRoute(G, from, to); if (!rt) return [];
    const pts = []; for (let i = 2; i < rt.xz.length - 2; i += 2) pts.push({ x: rt.xz[i], z: rt.xz[i + 1] });
    // (thinned: a point every metre and a half or so)
    const out = []; let last = from; for (const p of pts) if (Math.hypot(p.x - last.x, p.z - last.z) > 1.5) { out.push(p); last = p; }
    return out;
  }
  TP.lend = ({ to, names = null, hurry = false, notDoor = null } = {}) => {
    const b = best(names, to, { notDoor }); if (!b) return null;
    const r = b.r;
    if (!r.out && !emerge(r, b.door || doorOf('saloon'), 'door')) return null;
    release(r);
    // (half through a door: back out of it, dissolving back in from as faded as they were (the lent branch of
    // TP.update), never all at once in view)
    // (just out of a door: the steps first, then the way to the job; the dissolve goes on while the job walks them)
    const fresh = r.state === 'appear', from = fresh ? r.door : { x: r.x, z: r.z };
    const via = viaPoints(from, to); if (fresh) via.unshift({ x: r.door.x, z: r.door.z });
    r.lent = true; r.state = 'lent'; r.route = null; r.goal = null; r.wait = 0; r.after = null; r.expectKey = null;
    for (const e of TP.expecting.values()) e.names.delete(r.name);
    const rec = { who: r.who, name: r.name, p: r.p, x: r.x, z: r.z, yaw: r.yaw, via, lent: true, tp: r, hurry };
    r.job = rec;
    return rec;
  };
  TP.giveBack = (rec) => {
    const r = rec && rec.tp; if (!r || !r.lent) return;
    r.lent = false; r.job = null; r.x = rec.x; r.z = rec.z; r.yaw = rec.yaw ?? r.yaw; r.y = W.heightAt(r.x, r.z); r.out = true;
    if (r.p && r.fade < 1) r.fadeIn = true;   // (still dissolving in: it carries on, TP.update; never a snap in view)
    r.clip = r.p ? r.p.clip : ''; r.until = 0; r.state = 'stay';
    log(r, 'back', 'job', false);
  };
  // a job will want people soon: they start walking there (a place a few steps off `to`, so the job's own walk is short)
  // (exact: waiting on `to` itself, not a couple of steps off it: the end of the store's line)
  TP.expect = ({ key, to, names = null, n = 1, notDoor = null, exact = false }) => {
    let e = TP.expecting.get(key);
    if (!e || Math.hypot(e.to.x - to.x, e.to.z - to.z) > 4) { e = { to, names: new Set(), until: now() + TOWN.expect, exact }; TP.expecting.set(key, e); }
    e.until = now() + TOWN.expect;
    let have = e.names.size;
    while (have < n) {
      const b = best(names, to, { notDoor, skip: (r) => e.names.has(r.name) || [...TP.expecting.values()].some((x) => x !== e && x.names.has(r.name)) });
      if (!b) break;
      const r = b.r; e.names.add(r.name); have++;
      if (!r.out) { const d = b.door || doorOf('saloon'); if (!d || !emerge(r, d, 'door')) continue; r.after = { kind: 'expect', key, to }; }
      else sendTo(r, to, key);
    }
  };
  // walk to a place a couple of steps from `to` and wait there (an expected person)
  function sendTo(r, to, key) {
    release(r); r.expectKey = key;
    // (asked for while half through a door, stepping out or going in: they turn and go, dissolving back in from as
    // faded as they were. Left as it was, the fade stayed there and they walked about see-through)
    if (r.fade < 1) r.fadeIn = true;
    const e = TP.expecting.get(key), i = e ? [...e.names].indexOf(r.name) : 0, a = i * 1.9 + 0.6;
    let x = to.x + Math.sin(a) * 2.6, z = to.z + Math.cos(a) * 2.6; if (!free(x, z) || (e && e.exact && free(to.x, to.z))) { x = to.x; z = to.z; }
    // (never waiting out in the road: the store's place is in the street in front of its door. The nearest place round
    // it a little further off that is clear of the road, if there is one)
    if (!clearOfRoad(x, z)) {
      let got = null;
      for (const rr of [2.6, 4, 5.5, 7]) for (let k = 0; k < 12 && !got; k++) { const b = a + k * Math.PI / 6, px = to.x + Math.sin(b) * rr, pz = to.z + Math.cos(b) * rr; if (free(px, pz) && clearOfRoad(px, pz)) got = { x: px, z: pz }; }
      if (got) { x = got.x; z = got.z; }
    }
    r.goal = { kind: 'wait', to: { x, z } }; r.state = 'plan';
    const g = r.goal; ask({ x: r.x, z: r.z }, { x, z }, (rt) => { if (r.state === 'plan' && r.goal === g) startRoute(r, rt, Math.hypot(x - r.x, z - r.z) > 25); });
  }
  // the jobs' own predictions: walking up to the store, riding toward the sheriff's office with the loot
  function predict() {
    const pl = player(); if (!pl || !pl.position) return;
    const at = pl.position;
    const SJ = job('store');
    if (SJ && !SJ.active && P.store) {
      // (walking up to the store's door, or standing at it: a couple of customers start over)
      const d = Math.hypot(at.x - P.store.door.x, at.z - P.store.door.z), was = lastStore ? Math.hypot(lastStore.x - P.store.door.x, lastStore.z - P.store.door.z) : d;
      lastStore = { x: at.x, z: at.z };
      if (d < 7 || (d < 16 && was - d > 0.02)) { const o = frame(P.store).o; TP.expect({ key: 'store', to: { x: P.store.door.x + o.x * 5.5, z: P.store.door.z + o.z * 5.5 }, n: 2, names: storeNames(SJ), notDoor: 'store' }); }
    }
    // (the counter open: one more waiting at the end of its line, along the store's front away from the camera, so a
    // quick answer never waits on somebody walking over from a door across the town: src/missions/store.js's line)
    if (SJ && SJ.active && P.store) {
      const { o, s } = frame(P.store);
      TP.expect({ key: 'storeLine', to: { x: P.store.door.x + o.x * 2.9 + s.x * 4.2, z: P.store.door.z + o.z * 2.9 + s.z * 4.2 }, n: 1, names: storeNames(SJ), notDoor: 'store', exact: true });
    }
    const LJ = job('loot'), want = LJ && LJ.wanted ? LJ.wanted() : null;
    if (want && want.names && want.names.length) {
      const d = Math.hypot(at.x - want.at.x, at.z - want.at.z);
      const closing = lastAt ? (Math.hypot(lastAt.x - want.at.x, lastAt.z - want.at.z) - d) : 0;
      // (they wait where they will stand to take their shares: between the spot and the sheriff's door)
      const door = P.sheriff ? P.sheriff.door : want.at, k = Math.hypot(door.x - want.at.x, door.z - want.at.z) || 1, arc = { x: want.at.x + (door.x - want.at.x) / k * 3.7, z: want.at.z + (door.z - want.at.z) / k * 3.7 };
      if (d < TOWN.lootNear || (d < TOWN.lootFar && closing > 0.05)) TP.expect({ key: 'loot', to: arc, n: want.names.length, names: want.names });
      lastAt = { x: at.x, z: at.z };
    }
  }
  let lastAt = null, lastStore = null;
  const storeNames = (SJ) => { const busy = new Set(SJ && SJ.busyNames ? SJ.busyNames() : []); return TP.people.filter((r) => !busy.has(r.name)).map((r) => r.name); };

  // ── THE WINDOWS ──────────────────────────────────────────────────────────────────────────────────────────────────
  // (the world lights every building's windows at night: world/objects/nightLights.js through W.lights; a home's lamps
  // are lit only while somebody is in it, eased over a few seconds here, then again by the world)
  const lit = {};
  TP.windows = (n, dt = 0.016) => {
    if (!W.lights || !W.lights.set) return;
    for (const hm of homes) {
      const want = TP.people.some((r) => !r.out && r.in === hm.id) ? 1 : 0, was = lit[hm.id] ?? want;
      const v = was + Math.max(-dt / 3, Math.min(dt / 3, want - was));
      if (lit[hm.id] === undefined || Math.abs(v - lit[hm.id]) > 1e-4) { lit[hm.id] = v; W.lights.set(hm.id, v); }
    }
  };
  TP.lit = (id) => lit[id] ?? null;

  // standing people stop walkers (the player too), as the job folk do
  const offBlock = W.addBlocker ? W.addBlocker((x, z) => {
    if (townBlock) return false;
    for (const r of TP.people) if (r.out && !r.lent && r.state === 'stay' && Math.abs(x - r.x) < 0.42 && Math.abs(z - r.z) < 0.42) return true;
    return false;
  }) : () => {};

  // ── THE START: some already about when the ride begins (placed before anything is drawn) ─────────────────────────
  {
    const n = Math.round(outCap(outMost, night()) * TOWN.start), order = TP.people.slice().sort(() => Math.random() - 0.5);
    let placed = 0;
    for (const r of order) {
      if (placed >= n) break;
      const free2 = TP.spots.filter((s) => s.cap > s.used && (s.kind !== 'home' || s.home === r.home));
      if (!free2.length || !body(r)) continue;
      const s = free2[Math.floor(Math.random() * free2.length)], pt = take(r, s);
      r.x = pt.x; r.z = pt.z; r.y = W.heightAt(r.x, r.z); r.yaw = s.face; r.out = true; r.state = 'stay'; r.until = rnd(3, 30); r.want = s.face;
      r.p.root.visible = true; r.p.fade = 1; play(r, 'Idle', { fade: 0 }); placeBody(r); log(r, 'appear', 'start', false); placed++;
    }
  }

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
  let frameN = 0;
  TP.update = (dt, { hidden = false } = {}) => {
    layGrid(hidden ? 1 : 3); routeStep(); reopenMoved(dt);
    if (hidden || dt <= 0) return;
    dt = Math.min(dt, 0.1); frameN++;
    view();
    const n = night(); TP.windows(n, dt);
    predict();
    for (const [k, e] of TP.expecting) if (now() > e.until) TP.expecting.delete(k);
    const pl = player(), cam = camera.position, cap = outCap(outMost, n);
    let out = outCount();
    for (const r of TP.people) {
      if (r.lent) { if (r.p && r.fade < 1) { r.fade = Math.min(1, r.fade + dt / TOWN.door); r.p.fade = r.fade; } continue; }
      // (someone out and about, not in a door's dissolve, is always solid: anyone found part-faded is faded back in,
      // and it is said in the console, as it should never happen)
      if (r.out && r.p && r.fade < 1 && !r.fadeIn && r.state !== 'appear' && r.state !== 'enter' && r.state !== 'fadeout') {
        r.fadeIn = true; console.info(`town people: ${r.name} was out part-faded (${r.fade.toFixed(2)}, ${r.state}): fading back in`);
      }
      if (r.fadeIn) { if (r.p && r.fade < 1) { r.fade = Math.min(1, r.fade + dt / TOWN.door); r.p.fade = r.fade; } else r.fadeIn = false; }
      switch (r.state) {
        case 'inside': {
          if ((r.until -= dt) > 0 || !G) break;
          if (out >= cap) { r.until = rnd(4, 10); break; }
          const edge = TP.edges.find((e) => e.id === r.in);
          if (edge) { if (!seen(edge.x, edge.z)) { if (fromRoad(r, edge)) out++; } else r.until = rnd(2, 5); break; }
          const d = doorOf(r.in) || doorOf(r.home) || doorOf('saloon');
          // (nobody steps out of a door the player is looking at, unless they have waited a good while: then through
          // the door, dissolving in)
          if (d && (!seen(d.x, d.z) || (r.held = (r.held || 0) + 1) > 6)) { r.held = 0; if (emerge(r, d)) { out++; r.after = { kind: 'think' }; } } else r.until = rnd(3, 7);
          break;
        }
        case 'appear': {   // (out of a door: from the foot of the steps to its spot, dissolving in; through a real door,
                           // walked out as it swings open, there as soon as they are past the doorway)
          r.t += dt; const d = r.door, k = Math.min(1, r.t / (d.code ? TOWN.doorWalk : TOWN.door));
          r.fade = d.code ? Math.max(0, Math.min(1, (k - 0.12) / 0.3)) : k; r.p.fade = r.fade;
          r.x = d.step.x + (d.x - d.step.x) * k; r.z = d.step.z + (d.z - d.step.z) * k; r.yaw = d.face;
          if (k >= 1) { const a = r.after; r.after = null; if (a && a.kind === 'expect') sendTo(r, a.to, a.key); else { r.fresh = true; think(r); } }
          break;
        }
        case 'enter': {    // (in through a door: from its spot to the foot of the steps, dissolving out; through a real
                           // door, walked in as it swings open, gone once past the doorway, and it swings shut behind)
          r.t += dt; const d = r.door, k = Math.min(1, r.t / (d.code ? TOWN.doorWalk : TOWN.door));
          r.fade = d.code ? Math.min(1, (1 - k) / 0.4) : 1 - k; r.p.fade = r.fade;
          r.x = d.x + (d.step.x - d.x) * k; r.z = d.z + (d.step.z - d.z) * k; r.yaw = turnTo(r.yaw, d.face + Math.PI, dt * 8);
          if (k >= 1) goInside(r, d.id, 'door');
          break;
        }
        case 'away': {     // (off up the road: gone once out of sight; walking on along it while still in sight)
          r.t += dt; const e = r.edge;
          if (!seen(r.x, r.z, r.y)) { goInside(r, e.id, 'road'); break; }
          const nx = r.x + e.dir.x * r.speed * dt, nz = r.z + e.dir.z * r.speed * dt;
          if (r.t < 40 && free(nx, nz)) { r.x = nx; r.z = nz; r.yaw = turnTo(r.yaw, Math.atan2(e.dir.x, e.dir.z), dt * 4); if (r.clip !== 'Walk') play(r, 'Walk', { fade: 0.25, speed: walkSpeed(r, 'Walk') }); }
          else { r.state = 'fadeout'; r.t = 0; }
          break;
        }
        case 'fadeout': {   // (the last resort: still in sight at the end of the road, they fade)
          r.t += dt; r.fade = Math.max(0, 1 - r.t / TOWN.door); r.p.fade = r.fade;
          if (r.fade <= 0) goInside(r, r.edge ? r.edge.id : r.home, 'fade');
          break;
        }
        case 'walk': walk(r, dt); break;
        case 'stay': {
          if (r.clipT > 0 && (r.clipT -= dt) <= 0 && r.next) { play(r, r.next, { fade: 0.4 }); r.next = null; }
          if (r.want != null) r.yaw = turnTo(r.yaw, r.want, dt * 3);
          // (an expected person waits for the job a while, turned toward its place)
          if (r.goal && r.goal.kind === 'wait') { const e = TP.expecting.get(r.expectKey); if (e) { r.until = Math.max(r.until, 1); r.want = Math.atan2(e.to.x - r.x, e.to.z - r.z); } else { r.goal = null; r.expectKey = null; r.until = rnd(5, 20); } }
          if ((r.until -= dt) <= 0) think(r);
          // (two people standing in each other, at a door or a gathering spot: each eases a little way apart)
          for (const o of TP.people) {
            if (o === r || !o.out || o.state === 'inside') continue;
            const ox = o.lent && o.job ? o.job.x : o.x, oz = o.lent && o.job ? o.job.z : o.z;
            const dx = r.x - ox, dz = r.z - oz, d = Math.hypot(dx, dz); if (d >= TOWN.apart) continue;
            const ux = d > 1e-3 ? dx / d : Math.sin(r.yaw + Math.PI / 2), uz = d > 1e-3 ? dz / d : Math.cos(r.yaw + Math.PI / 2);
            const step = Math.min(TOWN.apart - d, dt * 0.6), nx = r.x + ux * step, nz = r.z + uz * step;
            if (!G || openAt(G, nx, nz)) { r.x = nx; r.z = nz; }
          }
          // (a wagon stopped close in front of them, waiting on them: after a moment they move on out of its way, as
          // a walker steps aside. Not one expected at a job: they wait off the road already)
          const WG = r.state === 'stay' && !(r.goal && r.goal.kind === 'wait') ? wagonWaiting(r) : null;
          if (WG) { if ((r.wagonT = (r.wagonT || 0) + dt) > TOWN.wagonWait) { r.wagonT = 0; if (!stepAside(r, WG)) think(r); break; } } else r.wagonT = 0;
          // (the player close by: turn to look at them)
          if (pl && pl.position && Math.hypot(pl.position.x - r.x, pl.position.z - r.z) < 4) r.yaw = turnTo(r.yaw, Math.atan2(pl.position.x - r.x, pl.position.z - r.z), dt * 3);
          break;
        }
        default: break;
      }
    }
    // placing, drawing and animating (far ones and unseen ones less often)
    for (const r of TP.people) {
      if (!r.p || r.lent || !r.out) continue;
      const gy = W.heightAt(r.x, r.z); r.y += (gy - r.y) * Math.min(1, dt * 10);
      placeBody(r);
      const d = Math.hypot(r.x - cam.x, r.z - cam.z);
      if (shadows) { const cast = d < TOWN.shadowNear && r.fade > 0.5; if (r.p.mesh.castShadow !== cast) { r.p.mesh.castShadow = cast; if (r.p.hat) r.p.hat.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); } }
      r.anim += dt;
      const every = d < TOWN.near ? 1 : d < TOWN.far ? 2 : 4;
      S.center.set(r.x, r.y + 0.9, r.z); S.radius = 1.2;
      if (!fr.intersectsSphere(S)) { r.anim = Math.min(r.anim, 1); continue; }
      if ((frameN + r.name.length) % every === 0) { r.p.update(r.anim); r.anim = 0; }
      // howdy, when the player comes close
      if (pl && pl.position && r.state !== 'enter' && r.state !== 'appear') {
        const dp = Math.hypot(pl.position.x - r.x, pl.position.z - r.z);
        if (r.watch.update(dt, dp)) howdy(r.p, null, { riding: !!pl.onHorse, key: r.name });
      }
    }
    TP.walkers.length = 0; for (const r of TP.people) if (r.out && !r.lent) TP.walkers.push(r);
  };
  TP.walkers = [];
  TP.laneSpot = () => (TP.lane ? { x: TP.lane.x, z: TP.lane.z, rot: Math.PI } : null);
  TP.way = (from, to) => viaPoints(from, to);   // (rigs: the way a townsperson would walk from one spot to another, [{ x, z }, ...])
  TP.dockSpot = () => { const d = TP.spots.find((q) => q.id === 'dock'); return d ? { x: d.x, z: d.z, rot: d.face } : null; };
  TP.state = () => ({ grid: !!G, gridMs: TP.gridMs || null, routes: routes.size, shut: shutBy.size, shutCells: G && G.base ? G.base.size : 0, cap: outCap(outMost, night()), night: night(), out: outCount(),
    expecting: [...TP.expecting].map(([k, e]) => ({ key: k, names: [...e.names] })),
    people: TP.people.map((r) => ({ name: r.name, home: r.home, state: r.state, out: r.out, lent: r.lent, in: r.out ? null : r.in, x: +r.x.toFixed(2), z: +r.z.toFixed(2), y: +r.y.toFixed(2),
      fade: +(r.p ? r.p.fade : r.fade).toFixed(2), drawn: !!(r.p && r.p.root.visible && (r.p.fade > 0)), clip: r.p ? r.p.clip : null, goal: r.goal ? r.goal.kind : null })) });
  TP.dispose = () => {
    offBlock(); if (offGov) offGov();
    for (const r of TP.people) if (r.p && !r.lent) { r.p.root.removeFromParent(); try { r.p.dispose(); } catch (e) { /* (gone) */ } }
    if (W.lights && W.lights.set) for (const hm of homes) W.lights.set(hm.id, 1);
    if (G) reopen(G);
    shutBy.clear();
  };
  return TP;
}
