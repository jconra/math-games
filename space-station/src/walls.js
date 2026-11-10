// WHERE A PERSON CAN WALK: the station's walls, floors and doors, worked out from the station as it was built (the
// kit's own merged meshes), never from hand-placed boxes. So when a room is moved or a hangar added, walking follows.
//
//   const walls = makeWalls(W.built)
//   walls.floorAt(x, z, top, drop)    the floor's height under a point: the highest surface not above `top` (and not
//                                     more than `drop` below it), or null where there is none
//   walls.free(x, y, z)               can a person stand with their feet there? (walls, furniture, a shut door)
//   walls.move(pos, dx, dz)           walk a person's feet (a Vector3, changed) that far, stopping at walls and sliding
//                                     along them, up and down steps and ramps; returns how far they got (metres)
//   walls.reach(from, dir, len)       how far a camera can go from a point along a direction before a wall (or a shut
//                                     door): `len` if nothing is in the way
//   walls.snap(x, top, z, far)        the nearest spot to stand near a point, on a floor no higher than `top` (a
//                                     Vector3), or null
//   walls.path(from, to)              a way to walk from one spot to another: [Vector3, ...], or null
//   walls.doors                       [{ D (the kit's door), box, locked }]; a locked door leads nowhere a person can
//                                     stand (the airlock's outer door) and stays shut
//
// HOW: two things are made once, when the station has loaded.
//   - Voxels (the kit's own, kit/bake.js) of every wall, floor, window and piece of furniture, 0.1 m across. A person
//     is a ring of points at three heights; a point in a full voxel is a wall.
//   - The floors: every triangle that faces up, sorted into half-metre squares. The floor under a point is the
//     highest of them within a step's reach, so stairs, ramps and raised floors work with nothing said about them.
// Door leaves are not part of either (they move): each door's leaves, shut, make a box that stops a person until the
// door is most of the way open.
import * as THREE from 'three';
import { makeVoxels } from '../kit/bake.js';

export const BODY = {
  r: 0.28,                       // a person's half width (m)
  heights: [0.6, 1.0, 1.45],     // the heights the walls are felt at (over the feet): above a stair's next treads
  stepUp: 0.32, stepDown: 0.5,   // the most a floor may rise or fall in one small step (a stair's riser is 0.18)
  low: 1.0, lowR: 0.2,           // a bed, a table, a chair: any surface this high or lower that is too tall to step on
  stride: 0.05,                  // a walk is checked every this far (m)
  doorOpen: 0.55,                // a door lets a person through once it is this far open (0 shut .. 1 open)
};
const FC = 0.5;                  // the floors' squares (m)

export function makeWalls(built, { voxel = 0.1 } = {}) {
  const t0 = performance.now();
  // ── the walls ────────────────────────────────────────────────────────────────────────────────────────────────
  const solid = [], up = [];
  for (const z of built.zones) {
    for (const k of ['solid', 'floor', 'glass', 'shield']) if (z.merged[k]) solid.push(z.merged[k]);
    for (const k of ['solid', 'floor']) if (z.merged[k]) up.push(z.merged[k]);
  }
  const V = makeVoxels(solid, voxel);
  const tV = performance.now();

  // ── the floors ───────────────────────────────────────────────────────────────────────────────────────────────
  const T = [], cells = new Map();
  const key = (i, k) => (i + 8192) * 16384 + (k + 8192);
  for (const g of up) {
    const p = g.attributes.position.array, ix = g.index.array;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
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
  function floorAt(x, z, top = Infinity, drop = Infinity) {
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
    doors.push({ D, box, locked: a === null || b === null });
  }
  function doorAt(x, y, z, r, doorsOpen = false) {
    for (const d of doors) {
      if (!d.locked && (doorsOpen || d.D.t >= BODY.doorOpen)) continue;
      const B = d.box;
      if (x > B.min.x - r && x < B.max.x + r && z > B.min.z - r && z < B.max.z + r && y + 1.7 > B.min.y && y < B.max.y) return d;
    }
    return null;
  }

  // ── a person ─────────────────────────────────────────────────────────────────────────────────────────────────
  const RX = [], RZ = [];
  for (let i = 0; i < 8; i++) { RX.push(Math.cos(i * Math.PI / 4)); RZ.push(Math.sin(i * Math.PI / 4)); }
  function free(x, y, z, r = BODY.r, doorsOpen = false) {
    for (const h of BODY.heights) {
      if (V.full(x, y + h, z)) return false;
      for (let i = 0; i < 8; i++) if (V.full(x + RX[i] * r, y + h, z + RZ[i] * r)) return false;
    }
    if (doorAt(x, y, z, r, doorsOpen)) return false;
    // something low in the way (a bed, a chair's seat, a table's top): too tall to step onto
    const lr = Math.min(r, BODY.lowR);
    for (let i = 0; i < 8; i += 2) { const f = floorAt(x + RX[i] * lr, z + RZ[i] * lr, y + BODY.low, BODY.low); if (f !== null && f > y + BODY.stepUp) return false; }
    return true;
  }
  function tryStep(pos, sx, sz, r, doorsOpen) {
    const x = pos.x + sx, z = pos.z + sz, f = floorAt(x, z, pos.y + BODY.stepUp, BODY.stepUp + BODY.stepDown);
    if (f === null || !free(x, f, z, r, doorsOpen)) return false;
    pos.x = x; pos.z = z; pos.y = f; return true;
  }
  // doorsOpen: walk as if every door that can open were open (for working out a way)
  function move(pos, dx, dz, r = BODY.r, doorsOpen = false) {
    const dist = Math.hypot(dx, dz); if (dist < 1e-6) return 0;
    const n = Math.max(1, Math.ceil(dist / BODY.stride)), sx = dx / n, sz = dz / n, x0 = pos.x, z0 = pos.z;
    for (let i = 0; i < n; i++) {
      if (tryStep(pos, sx, sz, r, doorsOpen)) continue;
      // a wall: slide along it (the station's walls run along x and z)
      const a = Math.abs(sx) > 1e-6 && tryStep(pos, sx, 0, r, doorsOpen), b = Math.abs(sz) > 1e-6 && tryStep(pos, 0, sz, r, doorsOpen);
      if (!a && !b) break;
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
  // over half-metre steps, each one walked as a person walks (so stairs, doors and furniture are all as they are for
  // the player), then straightened: [Vector3, ...] from `from` to `to`, or null. (Doors count as open: a person
  // walking up to one opens it.)
  const _p = new THREE.Vector3();
  function walkable(a, b, r) {
    _p.copy(a); move(_p, b.x - a.x, b.z - a.z, r, true);
    return Math.abs(_p.x - b.x) < 0.03 && Math.abs(_p.z - b.z) < 0.03 && Math.abs(_p.y - b.y) < 0.4;
  }
  // (a spot that cannot be reached, under a ship or past a sill too high to climb: the way goes as near to it as it can)
  function path(from, to, { r = BODY.r + 0.04, most = 12000 } = {}) {
    const G = 0.5, nodes = [], open = [], seen = new Map();
    const keyOf = (p) => Math.round(p.x / G * 2) + ',' + Math.round(p.z / G * 2) + ',' + Math.round(p.y * 2);
    const h = (p) => Math.hypot(p.x - to.x, p.z - to.z) + Math.abs(p.y - to.y);
    const push = (n) => { open.push(n); let i = open.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (open[j].f <= open[i].f) break; [open[i], open[j]] = [open[j], open[i]]; i = j; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, rr = l + 1; let m = i; if (l < open.length && open[l].f < open[m].f) m = l; if (rr < open.length && open[rr].f < open[m].f) m = rr; if (m === i) break; [open[i], open[m]] = [open[m], open[i]]; i = m; } } return top; };
    const start = { p: from.clone(), g: 0, f: h(from), up: null };
    push(start); seen.set(keyOf(from), 0);
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    // (a step of the search: four small steps, each a person's, as a wall is thinner than a person but thicker than none)
    const edge = (p, dx, dz) => { for (let s = 0; s < 4; s++) if (!tryStep(p, dx / 4, dz / 4, r, true)) return false; return true; };
    let end = null, n = 0, best = start;
    while (open.length && n++ < most) {
      const cur = pop();
      if (h(cur.p) < h(best.p)) best = cur;
      if (Math.hypot(cur.p.x - to.x, cur.p.z - to.z) < G * 1.2 && Math.abs(cur.p.y - to.y) < 0.5 && walkable(cur.p, to, r)) { end = { p: to.clone(), up: cur }; break; }
      for (const [dx, dz] of DIRS) {
        _p.copy(cur.p);
        if (!edge(_p, dx * G, dz * G)) continue;
        const g = cur.g + Math.hypot(dx, dz) * G + Math.abs(_p.y - cur.p.y), k = keyOf(_p);
        if (seen.has(k) && seen.get(k) <= g) continue;
        seen.set(k, g); push({ p: _p.clone(), g, f: g + h(_p), up: cur });
      }
    }
    if (!end) { if (best === start || h(best.p) > h(from) - 2) return null; end = best; }
    const raw = []; for (let q = end; q; q = q.up) raw.unshift(q.p);
    // straightened: from each point, on to the furthest one that can be walked to straight
    const out = [raw[0]];
    for (let i = 0; i < raw.length - 1;) {
      let j = Math.min(raw.length - 1, i + 16);
      while (j > i + 1 && !walkable(raw[i], raw[j], r)) j--;
      out.push(raw[j]); i = j;
    }
    return out;
  }

  // ── a camera ─────────────────────────────────────────────────────────────────────────────────────────────────
  // how far from a point along a direction (a unit vector) before a wall or a shut door, up to len
  function reach(from, dir, len) {
    let t = V.march(from.x, from.y, from.z, dir.x, dir.y, dir.z, len, voxel * 0.5);
    if (t < 0) t = len;
    for (const d of doors) {
      if (!d.locked && d.D.t >= BODY.doorOpen) continue;
      // (the ray against the door's box: the slab test)
      let t0 = 0, t1 = t, hit = true;
      for (const ax of ['x', 'y', 'z']) {
        const o = from[ax], v = dir[ax], lo = d.box.min[ax], hi = d.box.max[ax];
        if (Math.abs(v) < 1e-9) { if (o < lo || o > hi) { hit = false; break; } continue; }
        let a = (lo - o) / v, b = (hi - o) / v; if (a > b) { const s = a; a = b; b = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { hit = false; break; }
      }
      if (hit) t = Math.min(t, t0);
    }
    return t;
  }

  const stats = { voxelMs: Math.round(tV - t0), floorMs: Math.round(performance.now() - tV), bricks: V.bricks, voxelMB: +(V.bytes / 1048576).toFixed(1), floorTris: tri.length / 9, doors: doors.length, locked: doors.filter((d) => d.locked).length };
  return { V, floorAt, free, move, snap, path, reach, doors, stats, solidAt: (x, y, z) => V.full(x, y, z) };
}
