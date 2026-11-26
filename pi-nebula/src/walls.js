// WHERE A PERSON CAN WALK: the station's walls, floors and doors, worked out from the station as it was built (the
// kit's own merged meshes), never from hand-placed boxes. So when a room is moved or a hangar added, walking follows.
//
//   const walls = makeWalls(W.built, { portals: W.R.portals })   (portals: the station file's, for ways between rooms)
//   walls.floorAt(x, z, top, drop)    the floor's height under a point: the highest surface not above `top` (and not
//                                     more than `drop` below it), or null where there is none
//   walls.free(x, y, z)               can a person stand with their feet there? (walls, furniture, a shut door)
//   walls.move(pos, dx, dz)           walk a person's feet (a Vector3, changed) that far, stopping at walls and sliding
//                                     along them, up and down steps and ramps; returns how far they got (metres)
//   walls.reach(from, dir, len)       how far a camera can go from a point along a direction before a wall (or a shut
//                                     door): `len` if nothing is in the way
//   walls.snap(x, top, z, far)        the nearest spot to stand near a point, on a floor no higher than `top` (a
//                                     Vector3), or null
//   walls.path(from, to, { avoid })   a way to walk from one spot to another, however far: [Vector3, ...] (with .short:
//                                     metres it ends short of `to`, 0 when it gets there), or null; avoid(x, z): patches
//                                     of floor it never goes onto
//   walls.plan(from, to, { avoid })   the same, worked out a little at a time: .step(ms) -> true once done; .way
//   walls.doors                       [{ D (the kit's door), box, locked }]; a locked door leads nowhere a person can
//                                     stand (the airlock's outer door) and stays shut
//   walls.add(key, part) / drop(key)  more to walk in, made after the station: a parked ship's rooms while they are
//                                     loaded (boarding.js). part: { solid: [geometry], up: [geometry] (world space),
//                                     doors: [{ D, box }], when(pathing) (only while it says so: a stair that is a door,
//                                     while it is down), voxel (its voxels' size), r (a person's half width in it) }
//   walls.lift(key, dy, feet)         A MOVING FLOOR (a ship's lift: its platform and railings): a part added with
//                                     walls.add, moved up or down to `dy` metres from where it was made, carrying with
//                                     it anyone whose feet (Vector3s, changed) stand on its floors; returns how many it
//                                     carried. Every question asked of the part (its floors, its walls, a camera's
//                                     reach) is asked of it where it now is.
//   walls.place(key, M)               A PART STOOD SOMEWHERE ELSE than it was made (a ship set down by hand, anywhere on
//                                     its hangar's floor and whichever way round: the game's maker, 2026-11-18, "if the
//                                     pilot sets down and is still crooked then I would hope the crane can just compensate
//                                     for it"): M, a Matrix4 that turns it about straight up and moves it, from where it
//                                     was made to where it stands (null: back where it was made). Nothing of the part is
//                                     worked out again: every question is asked of it in its own frame, so its narrow
//                                     doors are exactly as wide as they were. Its doors go with it.
//   makeWalls(built, { apart })       apart: [room id]: rooms of the station that can be stood somewhere else (a parked
//                                     ship that flies). Each is left out of the station's own walls and added as a part
//                                     of its own, 'room:<id>', its doors with it, to be placed with walls.place.
//   makeWalls(built, { ground })      ground(x, z): A GROUND UNDER EVERYTHING, its height (a planet's land: src/planet/
//                                     land.js heightAt), a floor everywhere as the station's floors are (a step up or down
//                                     it as on a ramp; too steep, as a wall), and a camera's line stopped at it. With
//                                     no station (built: { zones: [], doors: [] }) only the ground and the parts added
//                                     later (a ship set down on it, the pods, the wreck, the rocks: src/planet/onfoot.js).
//
// HOW: two things are made once, when the station has loaded.
//   - Voxels (the kit's own, kit/bake.js) of every wall, floor, window and piece of furniture, 0.1 m across. A person
//     is a ring of points at three heights; a point in a full voxel is a wall.
//   - The floors: every triangle that faces up, sorted into half-metre squares. The floor under a point is the
//     highest of them within a step's reach, so stairs, ramps and raised floors work with nothing said about them.
// Door leaves are not part of either (they move): each door's leaves, shut, make a box that stops a person until the
// door is most of the way open. A part that glides by itself (the big scanner's ring) is not part of either: the
// whole box it glides through stops a person, always.
import * as THREE from 'three';
import { makeVoxels, makeVoxelsSoon } from '../kit/bake.js';
import { frameOf } from './standing.js';

export const BODY = {
  r: 0.28,                       // a person's half width (m)
  heights: [0.6, 1.0, 1.45],     // the heights the walls are felt at (over the feet): above a stair's next treads
  stepUp: 0.36, stepDown: 0.5,   // the most a floor may rise or fall in one small step (a stair's riser is 0.18; a
                                 // ship's airstair's first tread is 0.35 off the floor)
  low: 1.0, lowR: 0.2,           // a bed, a table, a chair: any surface this high or lower that is too tall to step on
  stride: 0.05,                  // a walk is checked every this far (m)
  doorOpen: 0.55,                // a door lets a person through once it is this far open (0 shut .. 1 open)
};
const FC = 0.5;                  // the floors' squares (m)
// a person walking head on into a door's frame is eased sideways into the opening, up to `most` (m), in steps of `step`
export const NUDGE = { most: 0.24, step: 0.02 };

// THE WALLS' VOXELS AHEAD (2026-11-26, THE MAKER WHILE THE GAME LOADS): the station's and its rooms-apart's voxels,
// made a piece at a time (bake.js makeVoxelsSoon) with the page given its turn between, then handed to makeWalls as
// `ahead`; the very same voxels as makeWalls makes itself
function wallsGeos(built, apart) {
  const solid = [], up = [], own = new Map();
  for (const z of built.zones) {
    // (a room that can be stood somewhere else: a part of its own, below)
    const S = apart.includes(z.id) ? { solid: [], up: [] } : null; if (S) own.set(z.id, S);
    for (const k of ['solid', 'floor', 'glass', 'shield']) if (z.merged[k]) (S ? S.solid : solid).push(z.merged[k]);
    for (const k of ['solid', 'floor']) if (z.merged[k]) (S ? S.up : up).push(z.merged[k]);
  }
  return { solid, up, own };
}
export async function wallsAhead(built, { voxel = 0.1, apart = [] } = {}) {
  const { solid, up, own } = wallsGeos(built, apart), rooms = new Map(), floors = new Map();
  const turn = () => new Promise((go) => setTimeout(go, 0));
  const station = solid.length ? await makeVoxelsSoon(solid, voxel) : null;
  const F0 = await makeFloorsSoon(up, turn);
  for (const [id, S] of own) { if (S.solid.length) rooms.set(id, await makeVoxelsSoon(S.solid, voxel)); floors.set(id, await makeFloorsSoon(S.up, turn)); }
  return { voxel, station, rooms, F0, floors };
}
export function makeWalls(built, { voxel = 0.1, portals = null, apart = [], ground = null, ahead = null } = {}) {
  const t0 = performance.now();
  // ── the walls and the floors: the station's, and the parts added later (each its own, tried after it) ──────────
  const { solid, up, own } = wallsGeos(built, apart), A = ahead && ahead.voxel === voxel ? ahead : null;
  // (no walls of the station's own, a planet's ground alone: nothing is full, a line goes on)
  const V = solid.length ? (A && A.station) || makeVoxels(solid, voxel) : { full: () => false, march: () => -1, bricks: 0, bytes: 0 };
  const tV = performance.now();
  const F0 = (A && A.F0) || makeFloors(up);
  const parts = new Map();
  let extra = [];                 // (the parts in play: for the loops below, no Map walked on every step)
  let pathing = false;            // (working out a way: a part whose `when` asks is counted as if its door were open)
  const live = (L) => !L.when || L.when(pathing);
  // (a part that moves up and down, walls.lift, is asked where it was made: y less its dy, the answer plus its dy)
  // (a part stood somewhere else, walls.place, is asked in its own frame: `fr` is its turn about straight up (c, s) and
  // its move (x, y, z); a point of the station comes into it as (c dx - s dz, s dx + c dz), and goes back out of it as
  // (c lx + s lz + x, -s lx + c lz + z))
  function floorAt(x, z, top = Infinity, drop = Infinity) {
    let best = F0.at(x, z, top, drop);
    if (ground) { const g = ground(x, z); if (g <= top && g >= top - drop && (best === null || g > best)) best = g; }
    for (const L of extra) {
      const fr = L.fr; let lx = x, lz = z, dy = L.dy;
      if (fr) { const dx = x - fr.x, dz = z - fr.z; lx = fr.c * dx - fr.s * dz; lz = fr.s * dx + fr.c * dz; dy += fr.y; }
      if (lx < L.box.min.x || lx > L.box.max.x || lz < L.box.min.z || lz > L.box.max.z || !live(L)) continue;
      let f = L.F.at(lx, lz, top - dy, drop); if (f !== null) f += dy;
      if (f !== null && (best === null || f > best)) best = f;
    }
    return best;
  }
  function full(x, y, z) {
    if (V.full(x, y, z)) return true;
    for (const L of extra) {
      if (!L.V) continue;
      const fr = L.fr; let lx = x, lz = z, u = y - L.dy;
      if (fr) { const dx = x - fr.x, dz = z - fr.z; lx = fr.c * dx - fr.s * dz; lz = fr.s * dx + fr.c * dz; u -= fr.y; }
      if (lx >= L.box.min.x && lx <= L.box.max.x && lz >= L.box.min.z && lz <= L.box.max.z && u >= L.box.min.y && u <= L.box.max.y && live(L) && L.V.full(lx, u, lz)) return true;
    }
    return false;
  }

  // ── the doors ────────────────────────────────────────────────────────────────────────────────────────────────
  const doors = [], _b = new THREE.Box3(), _m = new THREE.Matrix4();
  for (const D of built.doors) {
    const box = new THREE.Box3();
    for (const leaf of D.leaves) for (const im of leaf.meshes || []) {
      if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
      box.union(_b.copy(im.geometry.boundingBox).applyMatrix4(_m.copy(leaf.M).multiply(leaf.base)));
    }
    if (box.isEmpty()) continue;
    // does it lead anywhere? a floor to stand on a metre off each of its faces (its thin way)
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), alongX = size.x < size.z;
    const off = (alongX ? size.x : size.z) / 2 + 1, y = box.min.y + 0.6;
    const a = floorAt(c.x + (alongX ? off : 0), c.z + (alongX ? 0 : off), y, 1.2), b = floorAt(c.x - (alongX ? off : 0), c.z - (alongX ? 0 : off), y, 1.2);
    // (a door of a room that can be stood somewhere else goes with that room's part: its legs, its lift)
    doors.push({ D, box, locked: a === null || b === null, ...(own.has(D.zone) ? { part: 'room:' + D.zone, fixed: true } : {}) });
  }
  // what glides by itself (the big scanner's ring along its rails: kit/piece.js glide): the whole box it passes
  // through counts as a door that never opens. So nobody can stand in its way, be pushed by it or be shut in by it,
  // and a camera never sits where it is about to pass.
  for (const D of built.glides || []) if (D.glide.sweep && D.hold == null && !D.sweep.isEmpty()) doors.push({ D, box: D.sweep, locked: true, glide: true });
  function doorAt(x, y, z, r, doorsOpen = false) {
    for (const d of doors) {
      if (d.when && !d.when(pathing)) continue;
      if (!d.locked && (doorsOpen || d.D.t >= (d.open ?? BODY.doorOpen))) continue;
      const B = d.box, fr = d.fr; let lx = x, lz = z, ly = y;
      if (fr) { const dx = x - fr.x, dz = z - fr.z; lx = fr.c * dx - fr.s * dz; lz = fr.s * dx + fr.c * dz; ly -= fr.y; }
      if (lx > B.min.x - r && lx < B.max.x + r && lz > B.min.z - r && lz < B.max.z + r && ly + 1.7 > B.min.y && ly < B.max.y) return d;
    }
    return null;
  }

  // ── a person ─────────────────────────────────────────────────────────────────────────────────────────────────
  const RX = [], RZ = [];
  for (let i = 0; i < 8; i++) { RX.push(Math.cos(i * Math.PI / 4)); RZ.push(Math.sin(i * Math.PI / 4)); }
  // (inside a part with a body of its own, a ship's cabin: a person there is that slim, as its narrow doors are drawn
  // for a person 0.5 m across)
  function radiusAt(x, y, z, r) {
    for (const L of extra) {
      if (!L.r || L.r >= r) continue;
      const fr = L.fr; let lx = x, lz = z, u = y - L.dy;
      if (fr) { const dx = x - fr.x, dz = z - fr.z; lx = fr.c * dx - fr.s * dz; lz = fr.s * dx + fr.c * dz; u -= fr.y; }
      if (lx >= L.box.min.x && lx <= L.box.max.x && lz >= L.box.min.z && lz <= L.box.max.z && u >= L.box.min.y && u <= L.box.max.y && live(L)) r = L.r;
    }
    return r;
  }
  // (in or beside a part stood somewhere else, a ship set down crooked, the ring of points a person is felt at is turned
  // with that part: so every question asked of its walls is the very one asked when it stands as it was made, and a
  // person fits its doors and slides along its walls exactly as they did)
  function free(x, y, z, r = BODY.r, doorsOpen = false) {
    if (extra.length) r = radiusAt(x, y, z, r);
    const fr = turned ? frameAtXZ(x, z) : null, c = fr ? fr.c : 1, s = fr ? fr.s : 0;
    for (const h of BODY.heights) {
      if (full(x, y + h, z)) return false;
      for (let i = 0; i < 8; i++) if (full(x + (c * RX[i] + s * RZ[i]) * r, y + h, z + (c * RZ[i] - s * RX[i]) * r)) return false;
    }
    if (doorAt(x, y, z, r, doorsOpen)) return false;
    // something low in the way (a bed, a chair's seat, a table's top): too tall to step onto
    const lr = Math.min(r, BODY.lowR);
    for (let i = 0; i < 8; i += 2) { const f = floorAt(x + (c * RX[i] + s * RZ[i]) * lr, z + (c * RZ[i] - s * RX[i]) * lr, y + BODY.low, BODY.low); if (f !== null && f > y + BODY.stepUp) return false; }
    return true;
  }
  function tryStep(pos, sx, sz, r, doorsOpen) {
    const x = pos.x + sx, z = pos.z + sz, f = floorAt(x, z, pos.y + BODY.stepUp, BODY.stepUp + BODY.stepDown);
    if (f === null || !free(x, f, z, r, doorsOpen)) return false;
    pos.x = x; pos.z = z; pos.y = f; return true;
  }
  // (the step taken from a point a little to either side, nearest first, up to NUDGE away: the person moved there)
  // (sideways a small step at a time, as a person would shuffle: never through anything)
  const _n = [new THREE.Vector3(), new THREE.Vector3()], _f = new THREE.Vector3();
  function nudge(pos, sx, sz, r, doorsOpen) {
    const L = Math.hypot(sx, sz), px = -sz / L * NUDGE.step, pz = sx / L * NUDGE.step, open = [true, true];
    _n[0].copy(pos); _n[1].copy(pos);
    for (let k = 1; k * NUDGE.step <= NUDGE.most + 1e-6; k++) for (let i = 0; i < 2; i++) {
      if (!open[i]) continue;
      const sg = i ? -1 : 1;
      if (!tryStep(_n[i], px * sg, pz * sg, r, doorsOpen)) { open[i] = false; continue; }
      _f.copy(_n[i]);
      if (tryStep(_f, sx, sz, r, doorsOpen)) { pos.copy(_f); return true; }
    }
    return false;
  }
  // doorsOpen: walk as if every door that can open were open (for working out a way)
  // (the frame of a part stood somewhere else that a person is in or beside, if any: `turned` says whether any part is)
  let turned = false;
  function frameAtXZ(x, z) {
    for (const L of extra) { const fr = L.fr; if (!fr) continue; const dx = x - fr.x, dz = z - fr.z, lx = fr.c * dx - fr.s * dz, lz = fr.s * dx + fr.c * dz; if (lx >= L.box.min.x && lx <= L.box.max.x && lz >= L.box.min.z && lz <= L.box.max.z) return fr; }
    return null;
  }
  const frameAt = (p) => frameAtXZ(p.x, p.z);
  function move(pos, dx, dz, r = BODY.r, doorsOpen = false) {
    const dist = Math.hypot(dx, dz); if (dist < 1e-6) return 0;
    // (somewhere no person can stand, as when a ship's ramp has come down where they were: out to the nearest spot)
    if (!free(pos.x, pos.y, pos.z, r, doorsOpen)) { const s = snap(pos.x, pos.y + BODY.stepUp, pos.z, 1.2, r); if (s) pos.copy(s); }
    const n = Math.max(1, Math.ceil(dist / BODY.stride)), sx = dx / n, sz = dz / n, x0 = pos.x, z0 = pos.z;
    for (let i = 0; i < n; i++) {
      if (tryStep(pos, sx, sz, r, doorsOpen)) continue;
      // a wall: slide along it (the station's walls run along x and z; in a part stood somewhere else, a ship set down
      // crooked, they run along that part's own two ways, so a person slides along its cabin's walls as ever)
      const fr = turned ? frameAt(pos) : null;
      // (the step's two parts, along the walls' own two ways)
      let ax = sx, az = 0, bx = 0, bz = sz;
      if (fr) { const l0 = fr.c * sx - fr.s * sz, l1 = fr.s * sx + fr.c * sz; ax = fr.c * l0; az = -fr.s * l0; bx = fr.s * l1; bz = fr.c * l1; }
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      const a = la > 1e-6 && tryStep(pos, ax, az, r, doorsOpen), b = lb > 1e-6 && tryStep(pos, bx, bz, r, doorsOpen);
      const L = Math.hypot(sx, sz), crawl = L < BODY.stride - 1e-6;
      // (one part taken, a slide along a wall. But if the part that went nowhere is the greater one, it may be a sliver
      // across their way that stopped it, below: that part tried again a stride long, once the slide is taken)
      if (a || b) { if (crawl && !b && lb > la) tryStep(pos, bx / lb * BODY.stride, bz / lb * BODY.stride, r, doorsOpen); else if (crawl && !a && la > lb) tryStep(pos, ax / la * BODY.stride, az / la * BODY.stride, r, doorsOpen); continue; }
      // A SLIVER, STEPPED OVER. A strip a few centimetres across where a body may not stand, or no floor is found (the
      // edge of a riser where one floor ends and the next begins; the corner of a cabinet's end, felt only where it falls
      // on one of the eight points a body is felt at), is crossed by a walking step without knowing. But someone held
      // up a moment walks on at a crawl, a few millimetres a frame, and such a step lands in the strip every time: they
      // stood there for good with the key held (the Medic: at the step up into its cockpit, and beside its bay's door,
      // by a cabinet's end, coming from the top of its port ramp; rigs/rescue-8/lab.cjs --mode=door, RESCUE_8.md). So a
      // step that goes nowhere is tried again a stride long: the way they push, then along the wall they slide on. It
      // lands only where a body may stand, as any step (nothing a body cannot pass is passed)
      if (crawl) {
        const k = BODY.stride / L;
        if (tryStep(pos, sx * k, sz * k, r, doorsOpen)) continue;
        if (la >= lb ? la > 1e-6 && tryStep(pos, ax / la * BODY.stride, az / la * BODY.stride, r, doorsOpen) : lb > 1e-6 && tryStep(pos, bx / lb * BODY.stride, bz / lb * BODY.stride, r, doorsOpen)) continue;
      }
      // head on into a door's frame, a little off its middle: eased sideways into the opening (a narrow ship's door
      // needs a person lined up within a hand's width, too fine for a thumb on a stick)
      if (!nudge(pos, sx, sz, r, doorsOpen)) break;
    }
    return Math.hypot(pos.x - x0, pos.z - z0);
  }
  // the nearest spot to stand near a point: the point itself, or rings round it out to `far`. top: the highest floor
  // taken (so a spot on the floor never lands on the bed beside it)
  function snap(x, top, z, far = 2.5, r = BODY.r) {
    for (let d = 0; d <= far + 1e-6; d += 0.1) {
      const n = d === 0 ? 1 : Math.max(6, Math.ceil(Math.PI * 2 * d / 0.12));
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, f = floorAt(px, pz, top, 3);
        if (f !== null && free(px, f, pz, r)) return new THREE.Vector3(px, f, pz);
      }
    }
    return null;
  }

  // ── a way from one spot to another ───────────────────────────────────────────────────────────────────────────
  // ROOMS FIRST (2026-11-16). A way between two of the station's rooms is planned room to room through the station
  // file's portals (its doors and the openings that reach the floor: makeWalls(built, { portals })), then walked out a
  // leg at a time, each leg a search across a room or two. One search across the whole station ran out of steps on the
  // way and stopped short, as near as it had got (the medical centre to the smelter's chair ended in the Medic hangar).
  // Within one room, or with no portals: one search, as before.
  // A LEG: over half-metre steps, each one walked as a person walks (so stairs, doors and furniture are all as they are
  // for the player), then straightened: [Vector3, ...] from `from` to `to`, or null. (Doors count as open: a person
  // walking up to one opens it.) The steps lie on one grid for the whole station, so a step worked out once is known
  // for good (STEPS), except near anything that can change (a door that can be locked, a part added later: worked out
  // every time).
  // The way says how it went: way.short (metres from its end to `to`; 0 when it gets there), way.legs (how many
  // searches it took), way.ms (the time spent working it out).
  //   walls.path(from, to, opts)    at once
  //   walls.plan(from, to, opts)    a little at a time: { step(ms) (works on it for about that long; true once done),
  //                                 done, way }: the station's people plan a few milliseconds a frame, so working out a
  //                                 long way never holds a frame up
  // opts.avoid(x, z) -> true: patches of floor the way never goes onto (it may leave one it starts on): the people's
  // own (people.js: the job spots' rings, the ships' ways in, the crane's loads)
  const _p = new THREE.Vector3(), _q = new THREE.Vector3();
  const LOOK = 0.1;          // (a straight walk is checked every this far: no wall is thinner than its voxels)
  const RADIUS = BODY.r + 0.04;
  // (straight from a to b with nothing in the way and onto no patch to avoid: given up at the first thing in the way)
  function straight(a, b, r, avoid = null) {
    _q.copy(a);
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / LOOK)), sx = (b.x - a.x) / n, sz = (b.z - a.z) / n;
    const inA = avoid ? avoid(a.x, a.z) : true;
    for (let i = 0; i < n; i++) {
      if (!tryStep(_q, sx, sz, r, true)) return false;
      if (!inA && avoid(_q.x, _q.z)) return false;
    }
    return Math.abs(_q.y - b.y) < 0.4;
  }
  // (from a to b as a person walks it, sliding along whatever it meets: ending within a hand's width of b)
  function walkable(a, b, r, avoid = null) {
    if (straight(a, b, r, avoid)) return true;
    if (avoid) return false;
    _p.copy(a); move(_p, b.x - a.x, b.z - a.z, r, true);
    return Math.abs(_p.x - b.x) < 0.03 && Math.abs(_p.z - b.z) < 0.03 && Math.abs(_p.y - b.y) < 0.4;
  }
  // (a spot that cannot be reached, under a ship or past a sill too high to climb: the way goes as near to it as it can)
  function* wayOf(from, to, opts) {
    // (from somewhere no person can stand: from the nearest spot that is)
    if (!free(from.x, from.y, from.z)) { const s = snap(from.x, from.y + BODY.stepUp, from.z, 1.2); if (s) from = s; }
    let way = yield* viaRooms(from, to, opts);
    if (way === undefined) way = yield* legOf(from, to, opts);
    if (way) { const e = way[way.length - 1]; way.short = +Math.hypot(e.x - to.x, e.z - to.z).toFixed(2); way.legs = way.legs || 1; }
    return way;
  }
  // (a search run for about `ms`: `pathing` is on only while it runs, never between its slices)
  function run(g, ms = Infinity) {
    const t = performance.now() + ms;
    for (;;) {
      let r;
      pathing = true;
      try { r = g.next(); } finally { pathing = false; }
      if (r.done) return { done: true, way: r.value };
      if (performance.now() > t) return { done: false, way: null };
    }
  }
  function path(from, to, opts = {}) {
    const t0 = performance.now(), r = run(wayOf(from, to, opts));
    if (r.way) r.way.ms = +(performance.now() - t0).toFixed(1);
    return r.way;
  }
  function plan(from, to, opts = {}) {
    const g = wayOf(from.clone(), to.clone(), opts);
    const P = {
      done: false, way: null, ms: 0,
      step(ms = 2) {
        if (P.done) return true;
        const t = performance.now(), r = run(g, ms);
        P.ms += performance.now() - t;
        if (r.done) { P.done = true; P.way = r.way; if (P.way) P.way.ms = +P.ms.toFixed(1); }
        return P.done;
      },
    };
    return P;
  }

  // (one search; one that does not get there is tried once more at a person's own size on a grid half as coarse, for a
  // gap a person wide and no wider, between two beds: the way keeps a little more room than a person where it can)
  const off = (w, p) => (w ? Math.hypot(w[w.length - 1].x - p.x, w[w.length - 1].z - p.z) : Infinity);
  function* legOf(a, b, opts) {
    const w = yield* pathOf(a, b, opts);
    if (off(w, b) <= 0.35 || (opts.r ?? RADIUS) <= BODY.r) return w;
    const g0 = opts.G || (radiusAt(a.x, a.y, a.z, BODY.r) < BODY.r || radiusAt(b.x, b.y, b.z, BODY.r) < BODY.r ? 0.125 : SG);
    const w2 = yield* pathOf(a, b, { ...opts, r: BODY.r, G: Math.min(g0, SG / 2) });
    return off(w2, b) < off(w, b) ? w2 : w;
  }

  // ── the rooms' map: which room joins which, and where a person crosses (the portal's middle, on the floor in its
  // doorway). Made the first time a way is asked for (by then the doors are all known).
  let map = null;
  function roomsMap() {
    if (map !== null) return map;
    map = false;
    if (!portals || !portals.length) return map;
    const rooms = built.zones.filter((z) => !z.with), ids = new Set(rooms.map((z) => z.id)), cross = [];
    for (const P of portals) {
      if (!ids.has(P.a) || !ids.has(P.b)) continue;
      const [lo, hi] = P.box, cx = P.door ? P.door[0] : (lo[0] + hi[0]) / 2, cz = P.door ? P.door[1] : (lo[2] + hi[2]) / 2;
      // (a window between two rooms, an opening that does not reach the floor, is no way through)
      const f = floorAt(cx, cz, lo[1] + BODY.stepUp, 0.8);
      if (f === null || lo[1] > f + 0.3) continue;
      const p = standOpen(cx, f, cz, 0.6); if (!p) continue;
      cross.push({ a: P.a, b: P.b, p, door: !!P.door });
    }
    map = { rooms, cross };
    return map;
  }
  // (the nearest spot a person can stand near a point, every door that can open counted open)
  function standOpen(x, y, z, far) {
    for (let d = 0; d <= far + 1e-6; d += 0.05) {
      const n = d === 0 ? 1 : Math.max(6, Math.ceil(Math.PI * 2 * d / 0.08));
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, f = floorAt(px, pz, y + BODY.stepUp, 1);
        if (f !== null && free(px, f, pz, RADIUS, true)) return new THREE.Vector3(px, f, pz);
      }
    }
    return null;
  }
  // (the rooms a point is in: every room whose box holds it, or the nearest)
  function roomsOf(p, M) {
    const out = [];
    let near = null, nd = Infinity;
    for (const z of M.rooms) {
      const B = z.box;
      if (p.x > B.min.x - 0.3 && p.x < B.max.x + 0.3 && p.z > B.min.z - 0.3 && p.z < B.max.z + 0.3 && p.y > B.min.y - 0.6 && p.y < B.max.y) out.push(z.id);
      const d = B.distanceToPoint(p); if (d < nd) { nd = d; near = z.id; }
    }
    if (!out.length && near) out.push(near);
    return out;
  }
  const d3 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y);
  // a way room to room: undefined where it does not apply (one room, no map: one search instead), null where there is
  // no way at all
  function* viaRooms(from, to, opts) {
    const M = roomsMap(); if (!M) return undefined;
    const A = roomsOf(from, M), B = roomsOf(to, M);
    if (!A.length || !B.length || A.some((id) => B.includes(id))) return undefined;
    // the crossings, nearest first (from `from` to a crossing of its room, crossing to crossing through the room they
    // share, the last into `to`'s room), by the distance straight across each room
    const C = M.cross, n = C.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const touches = (c, L) => L.includes(c.a) || L.includes(c.b);
    for (let i = 0; i < n; i++) if (touches(C[i], A)) dist[i] = d3(from, C[i].p);
    let last = -1, lastD = Infinity;
    for (;;) {
      let i = -1, di = Infinity;
      for (let k = 0; k < n; k++) if (!done[k] && dist[k] < di) { di = dist[k]; i = k; }
      if (i < 0 || di >= lastD) break;
      done[i] = 1;
      if (touches(C[i], B)) { const e = di + d3(C[i].p, to); if (e < lastD) { lastD = e; last = i; } }
      for (let k = 0; k < n; k++) {
        if (done[k] || !(C[k].a === C[i].a || C[k].a === C[i].b || C[k].b === C[i].a || C[k].b === C[i].b)) continue;
        const nd = di + d3(C[i].p, C[k].p); if (nd < dist[k]) { dist[k] = nd; prev[k] = i; }
      }
    }
    if (last < 0) return null;
    const stops = []; for (let i = last; i >= 0; i = prev[i]) stops.unshift(C[i].p);
    stops.push(to);
    // each leg walked out: from where the last one ended to the next crossing (a leg that stops short ends the way
    // there, as near as it got)
    const way = [from.clone()], joins = [];
    let at = from;
    for (const s of stops) {
      const leg = yield* legOf(at, s, opts);
      if (!leg) break;
      joins.push(way.length - 1);
      for (let i = 1; i < leg.length; i++) way.push(leg[i]);
      const e = leg[leg.length - 1];
      at = e;
      if (s !== to && Math.hypot(e.x - s.x, e.z - s.z) > 0.35) break;
    }
    if (way.length < 2) return null;
    // (a crossing that can be walked past straight, from the point before it to the one after, is left out: through a
    // wide opening at a slant, not by its middle)
    const r = opts.r ?? RADIUS;
    for (let k = joins.length - 1; k > 0; k--) { const j = joins[k]; if (j > 0 && j < way.length - 1 && straight(way[j - 1], way[j + 1], r, opts.avoid || null)) way.splice(j, 1); }
    way.legs = stops.length;
    return way;
  }

  // STEPS: the search's half-metre steps worked out so far, kept for good: each a point of the station's grid (x and z
  // multiples of the step), its floor's level and a direction -> the floor's height where the step ends (NaN: no way).
  // Only for the station's own grid and body, and only away from anything that can change: within 0.8 m of a door that
  // is locked (a parked ship's way in is, until its cabin is in; a door to space, the crane's rack) or in a part added
  // later (a ship's cabin, its ways in), a step is worked out every time. (A door that is not locked is no part of a way
  // being worked out: doors count as open.)
  const STEPS = new Map(), SG = 0.5;
  let moving = null;
  function nearMoving(x, z) {
    if (!moving) {
      moving = new Set();
      for (const d of doors) {
        if (!d.locked && !d.part && !d.when) continue;
        if (d.part) continue;      // (a part's doors lie inside its box, looked at below where the part now stands)
        const B = d.box;
        for (let i = Math.floor((B.min.x - 0.8) / SG); i <= Math.floor((B.max.x + 0.8) / SG); i++) for (let k = Math.floor((B.min.z - 0.8) / SG); k <= Math.floor((B.max.z + 0.8) / SG); k++) moving.add(i * 65536 + k);
      }
    }
    if (moving.has(Math.floor(x / SG) * 65536 + Math.floor(z / SG))) return true;
    for (const L of extra) { const B = L.wbox; if (x > B.min.x - 0.8 && x < B.max.x + 0.8 && z > B.min.z - 0.8 && z < B.max.z + 0.8) return true; }
    return false;
  }
  const stepKey = (i, k, y, dir) => ((((i + 2048) * 4096 + (k + 2048)) * 64 + (Math.round(y * 4) + 32)) * 8 + dir);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const HURRY = 1.2;         // (the search leans toward the goal this much: a little longer way, found far sooner)

  // (a way to or from a slim part, a ship's cabin, is worked out on a finer grid: its doors are narrow)
  function* pathOf(from, to, { r = RADIUS, most = 12000, avoid = null, G = (radiusAt(from.x, from.y, from.z, BODY.r) < BODY.r || radiusAt(to.x, to.y, to.z, BODY.r) < BODY.r ? 0.125 : SG) } = {}) {
    const open = [], seen = new Map(), keep = G === SG && r === RADIUS;
    const keyOf = (p) => ((Math.round(p.x / G * 2) + 32768) * 65536 + (Math.round(p.z / G * 2) + 32768)) * 64 + (Math.round(p.y * 2) + 32);
    const h = (p) => { const dx = p.x - to.x, dz = p.z - to.z; return Math.sqrt(dx * dx + dz * dz) + Math.abs(p.y - to.y); };
    const push = (n) => { open.push(n); let i = open.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (open[j].f <= open[i].f) break; [open[i], open[j]] = [open[j], open[i]]; i = j; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, rr = l + 1; let m = i; if (l < open.length && open[l].f < open[m].f) m = l; if (rr < open.length && open[rr].f < open[m].f) m = rr; if (m === i) break; [open[i], open[m]] = [open[m], open[i]]; i = m; } } return top; };
    // (a node: its point, and its place on the grid, or null off it: where the way starts, a door's middle)
    const start = { p: from.clone(), gi: null, gk: null, g: 0, f: h(from), h: h(from), up: null };
    push(start); seen.set(keyOf(from), 0);
    const add = (cur, p, gi, gk) => {
      const dx = p.x - cur.p.x, dz = p.z - cur.p.z, g = cur.g + Math.sqrt(dx * dx + dz * dz) + Math.abs(p.y - cur.p.y), k = keyOf(p);
      const s = seen.get(k); if (s !== undefined && s <= g) return;
      const hp = h(p);
      seen.set(k, g); push({ p: p.clone(), gi, gk, g, f: g + hp * HURRY, h: hp, up: cur });
    };
    // (onto a patch to avoid, from off it)
    const into = (a, x, z) => avoid && !avoid(a.x, a.z) && (avoid(x, z) || avoid((a.x + x) / 2, (a.z + z) / 2));
    // (a step of the search: four small steps, each a person's, as a wall is thinner than a person but thicker than none)
    const edge = (p, dx, dz) => { for (let s = 0; s < 4; s++) if (!tryStep(p, dx / 4, dz / 4, r, true)) return false; return true; };
    const edgeTo = (p, x, z) => { const n = Math.max(1, Math.ceil(Math.hypot(x - p.x, z - p.z) / 0.1)), dx = (x - p.x) / n, dz = (z - p.z) / n; for (let s = 0; s < n; s++) if (!tryStep(p, dx, dz, r, true)) return false; return true; };
    let end = null, n = 0, best = start;
    while (open.length && n++ < most) {
      if ((n & 63) === 0) yield;
      const cur = pop();
      if (cur.h < best.h) best = cur;
      // (the last step onto the spot at a person's own size: the way keeps a little more room than that, the spot need not)
      if (cur.h < G * 1.2 + 0.5 && Math.hypot(cur.p.x - to.x, cur.p.z - to.z) < G * 1.2 && Math.abs(cur.p.y - to.y) < 0.5 && walkable(cur.p, to, Math.min(r, BODY.r), avoid)) { end = { p: to.clone(), up: cur }; break; }
      if (cur.gi !== null) {
        // on the grid: its eight neighbours (each step worked out once, where nothing can change)
        const near = !keep || nearMoving(cur.p.x, cur.p.z);
        for (let di = 0; di < 8; di++) {
          const [dx, dz] = DIRS[di], gi = cur.gi + dx, gk = cur.gk + dz, x = gi * G, z = gk * G;
          if (into(cur.p, x, z)) continue;
          let y;
          if (!near && !nearMoving(x, z)) {
            const k = stepKey(cur.gi, cur.gk, cur.p.y, di);
            y = STEPS.get(k);
            if (y === undefined) { _p.copy(cur.p); y = edge(_p, dx * G, dz * G) ? _p.y : NaN; STEPS.set(k, y); }
          } else { _p.copy(cur.p); y = edge(_p, dx * G, dz * G) ? _p.y : NaN; }
          if (y !== y) continue;
          add(cur, _p.set(x, y, z), gi, gk);
        }
      } else {
        // off it (where the way starts, a door's middle): straight to the grid's points round it
        const i0 = Math.floor(cur.p.x / G), k0 = Math.floor(cur.p.z / G);
        for (let gi = i0 - 1; gi <= i0 + 2; gi++) for (let gk = k0 - 1; gk <= k0 + 2; gk++) {
          const x = gi * G, z = gk * G;
          if (Math.hypot(x - cur.p.x, z - cur.p.z) > G * 1.6 || into(cur.p, x, z)) continue;
          _p.copy(cur.p); if (!edgeTo(_p, x, z)) continue;
          add(cur, _p.set(x, _p.y, z), gi, gk);
        }
      }
      // (near a narrow door: straight to the middle of its opening and through it, as a narrow door rarely lies on the
      // grid; the station's own doors are wide enough for the grid's lines to pass through)
      for (const d of doors) {
        const B = d.box, fr = d.fr; if (d.locked || (d.when && !d.when(true))) continue;
        if (G === SG && Math.max(B.max.x - B.min.x, B.max.z - B.min.z) >= 1.0) continue;
        const cx = (B.min.x + B.max.x) / 2, cz = (B.min.z + B.max.z) / 2, fy = fr ? fr.y : 0;
        // (a door of a part stood somewhere else: its middle and the points either side of it, where the part stands)
        const wx = fr ? fr.c * cx + fr.s * cz + fr.x : cx, wz = fr ? -fr.s * cx + fr.c * cz + fr.z : cz;
        if (Math.hypot(cur.p.x - wx, cur.p.z - wz) > 1.6 || cur.p.y > B.max.y + fy || cur.p.y + 1.7 < B.min.y + fy) continue;
        const thinX = B.max.x - B.min.x < B.max.z - B.min.z;
        for (const o of [-0.45, 0, 0.45]) {
          const lx = thinX ? cx + o : cx, lz = thinX ? cz : cz + o, x = fr ? fr.c * lx + fr.s * lz + fr.x : lx, z = fr ? -fr.s * lx + fr.c * lz + fr.z : lz;
          if (into(cur.p, x, z)) continue;
          _p.copy(cur.p);
          if (!edgeTo(_p, x, z)) continue;
          add(cur, _p, null, null);
        }
      }
    }
    if (!end) { if (best === start || best.h > start.h - 2) return null; end = best; }
    const raw = []; for (let q = end; q; q = q.up) raw.unshift(q.p);
    // straightened: from each point on to a far one that can be walked to straight (the furthest of the next 16 if it
    // can; else halved, and halved again, toward the nearest)
    const out = [raw[0]];
    let looks = 0;
    for (let i = 0; i < raw.length - 1;) {
      let lo = i + 1, hi = Math.min(raw.length - 1, i + 16);
      if (hi > lo && !straight(raw[i], raw[hi], r, avoid)) {
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (straight(raw[i], raw[mid], r, avoid)) lo = mid; else hi = mid; if ((++looks & 7) === 0) yield; }
        hi = lo;
      }
      out.push(raw[hi]); i = hi;
    }
    out.searched = n;
    return out;
  }

  // ── a camera ─────────────────────────────────────────────────────────────────────────────────────────────────
  // how far from a point along a direction (a unit vector) before a wall or a shut door, up to len
  const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
  function reach(from, dir, len) {
    let t = V.march(from.x, from.y, from.z, dir.x, dir.y, dir.z, len, voxel * 0.5);
    if (t < 0) t = len;
    // (the ground under everything: the line stops a little over it)
    if (ground) for (let u = 0.2; u <= t; u += 0.2) if (from.y + dir.y * u < ground(from.x + dir.x * u, from.z + dir.z * u) + 0.25) { t = Math.max(0, u - 0.2); break; }
    for (const L of extra) {
      if (!L.V || !live(L)) continue;
      const fr = L.fr; let u;
      if (fr) { const dx = from.x - fr.x, dz = from.z - fr.z; u = L.V.march(fr.c * dx - fr.s * dz, from.y - L.dy - fr.y, fr.s * dx + fr.c * dz, fr.c * dir.x - fr.s * dir.z, dir.y, fr.s * dir.x + fr.c * dir.z, t, L.V.s * 0.5); }
      else u = L.V.march(from.x, from.y - L.dy, from.z, dir.x, dir.y, dir.z, t, L.V.s * 0.5);
      if (u >= 0) t = Math.min(t, u);
    }
    for (const d of doors) {
      if (d.when && !d.when(pathing)) continue;
      if (!d.locked && d.D.t >= (d.open ?? BODY.doorOpen)) continue;
      // (the ray against the door's box: the slab test; a door of a part stood somewhere else, in the part's frame)
      let t0 = 0, t1 = t, hit = true, O = from, Dv = dir;
      if (d.fr) { const fr = d.fr, dx = from.x - fr.x, dz = from.z - fr.z; O = _ro.set(fr.c * dx - fr.s * dz, from.y - fr.y, fr.s * dx + fr.c * dz); Dv = _rd.set(fr.c * dir.x - fr.s * dir.z, dir.y, fr.s * dir.x + fr.c * dir.z); }
      for (const ax of ['x', 'y', 'z']) {
        const o = O[ax], v = Dv[ax], lo = d.box.min[ax], hi = d.box.max[ax];
        if (Math.abs(v) < 1e-9) { if (o < lo || o > hi) { hit = false; break; } continue; }
        let a = (lo - o) / v, b = (hi - o) / v; if (a > b) { const s = a; a = b; b = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { hit = false; break; }
      }
      if (hit) t = Math.min(t, t0);
    }
    return t;
  }

  // ── parts added later ────────────────────────────────────────────────────────────────────────────────────────
  // (each with its own voxels and floors, and a box round them, so a step far from it costs a comparison or two)
  // (voxel: its own voxels' size, finer than the station's for a ship's narrow rooms; r: the body there)
  // (at: where it stands, if not where it is made: walls.place)
  // (box: its voxels' box, if more than its own (a camera's line is felt by a part only from inside that box: the
  // bridge to the Hauler gives one from the airlock to the Hauler's rooms, src/dockwalk.js)
  function add(key, { solid: S = [], up: U = [], doors: D = [], when = null, voxel: vs = voxel, r = null, at = null, box: vbox = null, voxels = null, floors = null } = {}) {
    drop(key);
    const t = performance.now(), L = { key, when, r, V: S.length ? voxels || makeVoxels(S, vs, vbox) : null, F: floors || makeFloors(U), box: new THREE.Box3(), doors: [], dy: 0, fr: null };
    for (const g of [...S, ...U]) { if (!g.boundingBox) g.computeBoundingBox(); L.box.union(g.boundingBox); }
    L.box.expandByScalar(0.6); L.wbox = L.box;
    for (const d of D) { const e = { D: d.D, box: d.box, locked: false, part: key, when }; L.doors.push(e); doors.push(e); }
    L.ms = Math.round(performance.now() - t);
    parts.set(key, L); extra = [...parts.values()];
    if (at) place(key, at);
    return L;
  }
  function drop(key) {
    const L = parts.get(key); if (!L) return false;
    for (const e of L.doors) { const i = doors.indexOf(e); if (i >= 0) doors.splice(i, 1); }
    parts.delete(key); extra = [...parts.values()]; turned = extra.some((X) => X.fr);
    return true;
  }
  // A PART STOOD SOMEWHERE ELSE: M turns it about straight up and moves it (a Matrix4; null, or no move at all: where it
  // was made). Its doors go with it. Nothing is worked out again.
  function place(key, M = null) {
    const L = parts.get(key); if (!L) return false;
    const e = M ? M.elements : null, still = !e || (Math.abs(e[0] - 1) < 1e-9 && Math.abs(e[8]) < 1e-9 && Math.abs(e[12]) < 1e-9 && Math.abs(e[13]) < 1e-9 && Math.abs(e[14]) < 1e-9);
    if (e && (Math.abs(e[5] - 1) > 1e-6 || Math.abs(e[1]) > 1e-6 || Math.abs(e[4]) > 1e-6)) throw new Error('walls.place: ' + key + ' may only be turned about straight up and moved');
    L.fr = still ? null : frameOf(e);      // (src/standing.js: the sums every follower of a ship shares)
    L.wbox = still ? L.box : L.box.clone().applyMatrix4(M);
    for (const d of doors) if (d.part === key) d.fr = L.fr;
    turned = extra.some((X) => X.fr);
    return true;
  }
  // A MOVING FLOOR: the part moved to dy (m, up from where it was made); whoever stands on its floors moves with it.
  // Standing on it: its floor right under their feet (within 6 cm) where it was. (Its doors, if any, stay where they are.)
  function lift(key, dy, feet = []) {
    const L = parts.get(key); if (!L) return 0;
    const d = dy - L.dy; if (Math.abs(d) < 1e-9) return 0;
    let n = 0;
    for (const p of feet) {
      if (!p) continue;
      const fr = L.fr; let lx = p.x, lz = p.z, ly = p.y - L.dy;
      if (fr) { const dx = p.x - fr.x, dz = p.z - fr.z; lx = fr.c * dx - fr.s * dz; lz = fr.s * dx + fr.c * dz; ly -= fr.y; }
      if (lx < L.box.min.x || lx > L.box.max.x || lz < L.box.min.z || lz > L.box.max.z) continue;
      const f = L.F.at(lx, lz, ly + 0.06, 0.12);
      if (f !== null && Math.abs(f - ly) < 0.06) { p.y += d; n++; }
    }
    L.dy = dy;
    return n;
  }

  const stats = { voxelMs: Math.round(tV - t0), floorMs: Math.round(performance.now() - tV), bricks: V.bricks, voxelMB: +(V.bytes / 1048576).toFixed(1), floorTris: F0.tris, doors: doors.length, locked: doors.filter((d) => d.locked).length };
  // the rooms that can be stood somewhere else, each a part of its own (felt exactly as when they were part of the
  // station's own walls, until they are placed)
  const tA = performance.now();
  for (const [id, S] of own) add('room:' + id, { solid: S.solid, up: S.up, voxels: (A && A.rooms.get(id)) || null, floors: (A && A.floors.get(id)) || null });
  stats.apartMs = Math.round(performance.now() - tA);
  // (radius(x, y, z): a person's half width against the walls there, BODY.r, or a ship's cabin's own where they are in one)
  return { V, floorAt, free, move, snap, path, plan, reach, doors, stats, add, drop, lift, place, parts, solidAt: (x, y, z) => full(x, y, z), steps: () => STEPS.size,
    radius: (x, y, z, r = BODY.r) => (extra.length ? radiusAt(x, y, z, r) : r) };
}

// THE FLOORS of a set of geometries: every triangle that faces up, sorted into half-metre squares; at(x, z, top, drop)
// the highest of them under a point, not above `top` and not more than `drop` below it (or null)
function makeFloors(geos) { const it = floorSteps(geos); let r; while (!(r = it.next()).done); return r.value; }
// (the same, some 12 ms' worth at a time, the page given its turn between: wallsAhead)
async function makeFloorsSoon(geos, turn) { const it = floorSteps(geos); let r, t0 = performance.now(); while (!(r = it.next()).done) if (performance.now() - t0 > 12) { await turn(); t0 = performance.now(); } return r.value; }
function* floorSteps(geos) {
  const T = [], cells = new Map();
  const key = (i, k) => (i + 8192) * 16384 + (k + 8192);
  for (const g of geos) {
    const p = g.attributes.position.array, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.length / 3;
    for (let t = 0; t < n; t += 3) {
      if (t % 3000 === 0) yield;
      const a = (ix ? ix[t] : t) * 3, b = (ix ? ix[t + 1] : t + 1) * 3, c = (ix ? ix[t + 2] : t + 2) * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz);
      if (len < 1e-9 || ny / len < 0.6) continue;                     // (faces up: a floor, a tread, a table's top)
      const id = T.length / 9; T.push(p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]);
      const i0 = Math.floor(Math.min(p[a], p[b], p[c]) / FC), i1 = Math.floor(Math.max(p[a], p[b], p[c]) / FC);
      const k0 = Math.floor(Math.min(p[a + 2], p[b + 2], p[c + 2]) / FC), k1 = Math.floor(Math.max(p[a + 2], p[b + 2], p[c + 2]) / FC);
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const q = key(i, k); let L = cells.get(q); if (!L) cells.set(q, L = []); L.push(id); }
    }
  }
  const tri = Float32Array.from(T);
  function at(x, z, top = Infinity, drop = Infinity) {
    const L = cells.get(key(Math.floor(x / FC), Math.floor(z / FC))); if (!L) return null;
    let best = null; const low = top - drop;
    for (let n = 0; n < L.length; n++) {
      const o = L[n] * 9, ax = tri[o], az = tri[o + 2], bx = tri[o + 3], bz = tri[o + 5], cx = tri[o + 6], cz = tri[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
      if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
      const y = u * tri[o + 1] + v * tri[o + 4] + w * tri[o + 7];
      if (y <= top && y >= low && (best === null || y > best)) best = y;
    }
    return best;
  }
  return { at, tris: tri.length / 9 };
}
