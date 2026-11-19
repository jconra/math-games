// WHAT A FLYING SHIP BUMPS INTO: the station's outside as a field of distances, made from the outside's own triangles
// (kit/outside-plan.js, kit/hull-plates.js), so it follows the outside whenever that is redrawn. No page, no three.js:
// node tests it (tests/flying.test.mjs).
//
// THE GAME'S MAKER (2026-11-18, of flying): bumping the station or the door frame does no damage: "you stop or slide
// along it". So nothing here is hard: a ship that comes within `r` of anything is eased back out along the way that
// leads away from it, and keeps whatever of its speed runs along the surface.
//
// HOW: the box round the station is cut into cubes of one metre. Every triangle is sampled; a cube any sample falls in
// keeps the middle of its samples and the way their triangles face (a small flat patch). Each cube within REACH of a
// patch then holds how far its middle is from the nearest patch, in one byte. dist(x, y, z) reads that smoothly
// between the cubes' middles; away(x, y, z) is the way the distance grows. Nothing knows inside from outside: a ship
// simply cannot come nearer than `r` to any surface, from either side, so it never gets through one (the ship's motion
// is taken in steps shorter than that: src/flymodel.js).
//
// THE GAME'S MAKER (2026-11-18, later, asked whether the Miner should be able to fly in through the other two hangar
// doors): "Lol, I'm sure kids will try to do this and it will make them laugh, so why not." So the other two hangars
// are open to it as its own is (`bays`); the ships parked in them are not part of this field (they can be shoved
// about: src/flymodel.js OTHERS, pushOthers).
//
// ADDED TO THE OUTSIDE'S OWN TRIANGLES (the real rooms are not part of the outside):
//   - a flat cap across every real opening but the hangar doors a ship may fly in through (its own, and the other
//     hangars given as `bays`): the windows, and any hangar not given, are shut to it;
//   - THE BAYS: the way in from each such door to where a ship parks, a straight box as wide and as tall as the door
//     (in the Miner's hangar the crane's rail, the canister rack and the catwalk are all outside it, and in the other
//     two the crates, the stairs and the catwalk are, so none of them needs its own shape), with its floor the
//     hangar's floor.
//
//   const solid = stationSolid({ bay, bays })     from the plan itself (the tests; the game too, in about a quarter second)
//   const solid = buildSolid(triangleLists, { box, caps, bay })
//   solid.dist(x, y, z)       metres to the nearest surface (REACH and more: REACH)
//   solid.away(x, y, z, out)  the way that leads away from it, into out [x, y, z] (a unit; [0, 0, 0] where nothing is near)
//   solid.clear(a, b, r)      how far along the straight line from a to b stays r clear of everything (0..1)
import { outsidePlans, outsideGear, OPENINGS, OUTSIDE_BOX, DOOR } from '../kit/outside-plan.js';
import { hullArrays } from '../kit/hull-plates.js';
import { STATION_LOOK, plateSizes } from '../kit/hull-look.js';

export const VOXEL = 1, REACH = 3;      // the cubes' size, and how far out from a surface the distances are kept (metres)
export const SKIN = 0.8;                // how near a ship's own points may come to anything (metres)

// THE BAY of a hangar whose door is at z = `z`: from the door's outer face in to `back` (the crane parks beyond it),
// the door's own width and `top` high (the crane's rail is at 8.5 m; the door itself is 9 m)
export const bayOf = (z, { back = 23.5, top = 8.4 } = {}) => ({ x0: back, x1: DOOR.face + 0.6, z0: z - DOOR.w / 2, z1: z + DOOR.w / 2, y0: 0, y1: top });

// the outside's own triangles, as the game builds it (the real rooms inside: no frame, shield or glass of its own)
export function outsideTriangles(look = STATION_LOOK) {
  const S = { ...plateSizes(look), lap: 0 }, lists = [];
  for (const plan of outsidePlans({ inside: true })) { const A = hullArrays(plan, S); for (const g of ['band', 'tiers', 'trim']) if (A.groups[g].index.length) lists.push({ position: A.groups[g].position, index: A.groups[g].index }); }
  const gear = outsideGear({ inside: true });
  lists.push({ position: gear.lit.position, index: gear.lit.index }, { position: gear.glow.position, index: gear.glow.index });
  return lists;
}

// a flat four-cornered piece as two triangles
const quad = (a, b, c, d) => ({ position: new Float32Array([...a, ...b, ...c, ...d]), index: new Uint32Array([0, 1, 2, 0, 2, 3]) });
// the caps across the real openings (all but those at `open`: one [x, z] of an opening's middle, or a list of them)
export function capsOf(open = null) {
  const out = [], opens = !open ? [] : typeof open[0] === 'number' ? [open] : open;
  for (const o of OPENINGS) {
    if (opens.some((p) => Math.abs(o.at[0] - p[0]) < 0.5 && Math.abs(o.at[2] - p[1]) < 0.5)) continue;
    const [x, y, z] = o.at, along = o.out[0] ? [0, 0, 1] : [1, 0, 0], h = o.w / 2;
    out.push(quad([x - along[0] * h, y, z - along[2] * h], [x + along[0] * h, y, z + along[2] * h], [x + along[0] * h, y + o.h, z + along[2] * h], [x - along[0] * h, y + o.h, z - along[2] * h]));
  }
  return out;
}
// the bay's own walls: its floor, its roof, its two sides and its back, each set SKIN further out, so a ship's points
// stop exactly on the bay's own faces (its feet on the floor)
export function bayWalls(B, r = SKIN) {
  const { x0, x1, y0, y1, z0, z1 } = B, a = x0 - r, f = y0 - r, t = y1 + r, n = z0 - r, s = z1 + r;
  return [
    quad([a, f, n], [x1, f, n], [x1, f, s], [a, f, s]), quad([a, t, n], [x1, t, n], [x1, t, s], [a, t, s]),
    quad([a, f, n], [x1, f, n], [x1, t, n], [a, t, n]), quad([a, f, s], [x1, f, s], [x1, t, s], [a, t, s]),
    quad([a, f, n], [a, f, s], [a, t, s], [a, t, n]),
  ];
}

// the work itself, in steps (it gives way every so many triangles and patches), so that a page can spread its third of
// a second over a second or two of frames instead of stopping for it: solidJob below
function* solidSteps(lists, { box = OUTSIDE_BOX, voxel = VOXEL, reach = REACH, pad = 4, bay = null } = {}) {
  const t0 = Date.now(); let work = 0;
  const min = box.min.map((v) => Math.floor(v - pad)), max = box.max.map((v) => Math.ceil(v + pad));
  const nx = Math.ceil((max[0] - min[0]) / voxel), ny = Math.ceil((max[1] - min[1]) / voxel), nz = Math.ceil((max[2] - min[2]) / voxel), N = nx * ny * nz;
  // ── the patches: for each cube a sample fell in, the sum of the samples and of the ways their triangles face ──
  const slot = new Int32Array(N).fill(-1); let cap = 1 << 16, n = 0;
  let sum = new Float32Array(cap * 7);
  const grow = () => { cap *= 2; const s = new Float32Array(cap * 7); s.set(sum); sum = s; };
  const drop = (x, y, z, ux, uy, uz, w) => {
    const i = Math.floor((x - min[0]) / voxel), j = Math.floor((y - min[1]) / voxel), k = Math.floor((z - min[2]) / voxel);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    const c = (k * ny + j) * nx + i; let s = slot[c];
    if (s < 0) { if (n >= cap) grow(); s = slot[c] = n++; }
    const o = s * 7;
    // (the ways are added the same way up, so two sides of a thin plate do not cancel)
    const flip = sum[o + 3] * ux + sum[o + 4] * uy + sum[o + 5] * uz < 0 ? -1 : 1;
    sum[o] += x * w; sum[o + 1] += y * w; sum[o + 2] += z * w; sum[o + 3] += ux * w * flip; sum[o + 4] += uy * w * flip; sum[o + 5] += uz * w * flip; sum[o + 6] += w;
  };
  let tris = 0;
  for (const { position: P, index: I } of lists) {
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2], ex = P[b] - ax, ey = P[b + 1] - ay, ez = P[b + 2] - az, fx = P[c] - ax, fy = P[c + 1] - ay, fz = P[c + 2] - az;
      let ux = ey * fz - ez * fy, uy = ez * fx - ex * fz, uz = ex * fy - ey * fx; const A = Math.hypot(ux, uy, uz); if (A < 1e-9) continue;
      ux /= A; uy /= A; uz /= A; tris++;
      const longest = Math.max(Math.hypot(ex, ey, ez), Math.hypot(fx, fy, fz), Math.hypot(fx - ex, fy - ey, fz - ez)), m = Math.max(1, Math.ceil(longest / (voxel * 0.45)));
      for (let p = 0; p <= m; p++) for (let q = 0; q <= m - p; q++) { const u = p / m, v = q / m; drop(ax + ex * u + fx * v, ay + ey * u + fy * v, az + ez * u + fz * v, ux, uy, uz, 1); }
      if (++work % 1200 === 0) yield;
    }
  }
  // ── the distances: each patch marks the cubes round it ──
  const far = reach, D = new Uint8Array(N).fill(255), R = Math.ceil(reach / voxel), half = voxel * 0.75;
  for (let c = 0; c < N; c++) {
    const s = slot[c]; if (s < 0) continue;
    if (++work % 600 === 0) yield;
    const o = s * 7, w = sum[o + 6], px = sum[o] / w, py = sum[o + 1] / w, pz = sum[o + 2] / w;
    let ux = sum[o + 3], uy = sum[o + 4], uz = sum[o + 5]; const L = Math.hypot(ux, uy, uz) || 1; ux /= L; uy /= L; uz /= L;
    // (a cube where faces meet at a corner has no one way to face: it is a point there, not a flat patch)
    const flat = L / w > 0.9 ? half : 0;
    const i0 = c % nx, j0 = Math.floor(c / nx) % ny, k0 = Math.floor(c / (nx * ny));
    for (let k = Math.max(0, k0 - R); k <= Math.min(nz - 1, k0 + R); k++) for (let j = Math.max(0, j0 - R); j <= Math.min(ny - 1, j0 + R); j++) {
      const row = (k * ny + j) * nx, dz = min[2] + (k + 0.5) * voxel - pz, dy = min[1] + (j + 0.5) * voxel - py;
      for (let i = Math.max(0, i0 - R); i <= Math.min(nx - 1, i0 + R); i++) {
        const dx = min[0] + (i + 0.5) * voxel - px, along = dx * ux + dy * uy + dz * uz;
        const side = Math.max(0, Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along)) - flat), d = Math.sqrt(along * along + side * side);
        if (d < far) { const b = Math.round(d / far * 254); if (b < D[row + i]) D[row + i] = b; }
      }
    }
  }
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? far : D[(k * ny + j) * nx + i] === 255 ? far : D[(k * ny + j) * nx + i] / 254 * far);
  function dist(x, y, z) {
    const gx = (x - min[0]) / voxel - 0.5, gy = (y - min[1]) / voxel - 0.5, gz = (z - min[2]) / voxel - 0.5;
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    if (i < -1 || j < -1 || k < -1 || i >= nx || j >= ny || k >= nz) return far;
    const u = gx - i, v = gy - j, w = gz - k;
    const c00 = at(i, j, k) * (1 - u) + at(i + 1, j, k) * u, c10 = at(i, j + 1, k) * (1 - u) + at(i + 1, j + 1, k) * u;
    const c01 = at(i, j, k + 1) * (1 - u) + at(i + 1, j, k + 1) * u, c11 = at(i, j + 1, k + 1) * (1 - u) + at(i + 1, j + 1, k + 1) * u;
    return (c00 * (1 - v) + c10 * v) * (1 - w) + (c01 * (1 - v) + c11 * v) * w;
  }
  const E = voxel * 0.5;
  function away(x, y, z, out = [0, 0, 0]) {
    const gx = dist(x + E, y, z) - dist(x - E, y, z), gy = dist(x, y + E, z) - dist(x, y - E, z), gz = dist(x, y, z + E) - dist(x, y, z - E), L = Math.hypot(gx, gy, gz);
    if (L < 1e-6) { out[0] = out[1] = out[2] = 0; return out; }
    out[0] = gx / L; out[1] = gy / L; out[2] = gz / L; return out;
  }
  // how far along a -> b stays r clear (1: all the way)
  function clear(a, b, r = SKIN) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), steps = Math.max(1, Math.ceil(L / (voxel * 0.5)));
    for (let s = 0; s <= steps; s++) { const t = s / steps; if (dist(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t) < r) return Math.max(0, (s - 1) / steps); }
    return 1;
  }
  return { dist, away, clear, bay, min, max, size: [nx, ny, nz], voxel, reach, stats: { triangles: tris, patches: n, cubes: N, bytes: N, ms: Date.now() - t0 } };
}
// the work as a job: job.run(ms) does up to so many milliseconds of it and gives the solid once it is done (else
// null); job.finish() does whatever is left at once
export function solidJob(lists, opts) {
  const it = solidSteps(lists, opts); let solid = null;
  const step = () => { const r = it.next(); if (r.done) solid = r.value; };
  return { get done() { return !!solid; }, run(ms = 6) { const t = Date.now(); while (!solid && Date.now() - t < ms) step(); return solid; }, finish() { while (!solid) step(); return solid; } };
}
export const buildSolid = (lists, opts) => solidJob(lists, opts).finish();

// THE STATION, for a ship whose bay is `bay` (bayOf): the outside's own triangles, the other openings capped, the bay;
// `bays`: the other hangars it may fly into as well, each open at its door and with its own bay
// (stationJob: the same as a job, to be done a little each frame)
export function stationJob({ bay = null, bays = [], lists = null, look = STATION_LOOK, reach = REACH } = {}) {
  const own = lists || outsideTriangles(look), all = [bay, ...bays].filter(Boolean);
  const open = all.map((b) => [DOOR.x + 0.02, (b.z0 + b.z1) / 2]);
  return solidJob([...own, ...capsOf(open), ...all.flatMap((b) => bayWalls(b))], { reach, bay });
}
export const stationSolid = (opts) => stationJob(opts).finish();
