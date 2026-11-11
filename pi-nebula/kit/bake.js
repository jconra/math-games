// THE BAKE: worked out once when a room is built, stored in each vertex, free to draw after.
//   aAO    corner darkening (ambient occlusion: how much of the sky above a point its surroundings hide), 0..1
//   aBake  the light the glowing strips throw on it, with their shadows: the room is chopped into small cubes
//          (voxels) that are full where any surface passes, and a short walk through them from each vertex says
//          what is hidden (from the open sky round it, and from each light)
// Units: aBake is irradiance as a three.js point light gives it (intensity x cos / distance squared).
import * as THREE from 'three';

const SKY_JIT = [[0, 0], [0.32, 0.1], [-0.2, -0.3]];   // (three looks upward, a little apart, for a soft edge)
function fib(n) { // n directions spread evenly over a sphere
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * g; out.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  return out;
}

// The voxels are kept only near surfaces: the box is cut into bricks of 8 x 8 x 8 voxels, and a brick is stored only
// once a surface passes through it. Memory then grows with the surface area, not with the volume (a 30 m hangar is
// mostly empty air), and a walk through the air skips a whole empty brick in one step.
const BS = 8, BS3 = BS * BS * BS;
export class Voxels {
  constructor(box, size) {
    this.s = size; this.min = box.min.clone().subScalar(size * 2);
    const ext = box.max.clone().addScalar(size * 2).sub(this.min);
    this.nx = Math.ceil(ext.x / size); this.ny = Math.ceil(ext.y / size); this.nz = Math.ceil(ext.z / size);
    this.bx = Math.ceil(this.nx / BS); this.by = Math.ceil(this.ny / BS); this.bz = Math.ceil(this.nz / BS);
    this.brick = new Int32Array(this.bx * this.by * this.bz).fill(-1);   // which stored brick each one is, or -1 (all air)
    this.pool = new Uint8Array(BS3 * 256); this.used = 0;
  }
  get bricks() { return this.used; }
  get bytes() { return this.pool.byteLength + this.brick.byteLength; }
  get count() { return this.nx * this.ny * this.nz; }           // (how many voxels the whole box would have held)
  set(i, j, k) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    const bi = ((k >> 3) * this.by + (j >> 3)) * this.bx + (i >> 3);
    let b = this.brick[bi];
    if (b < 0) {
      if ((this.used + 1) * BS3 > this.pool.length) { const np = new Uint8Array(this.pool.length * 2); np.set(this.pool); this.pool = np; }
      b = this.brick[bi] = this.used++;
    }
    this.pool[b * BS3 + (((k & 7) << 3) + (j & 7)) * BS + (i & 7)] = 1;
  }
  full(x, y, z) {
    const i = Math.floor((x - this.min.x) / this.s), j = Math.floor((y - this.min.y) / this.s), k = Math.floor((z - this.min.z) / this.s);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return false;
    const b = this.brick[((k >> 3) * this.by + (j >> 3)) * this.bx + (i >> 3)];
    return b >= 0 && this.pool[b * BS3 + (((k & 7) << 3) + (j & 7)) * BS + (i & 7)] === 1;
  }
  // mark every voxel a geometry's triangles pass through (by sampling each triangle finer than a voxel)
  addGeometry(geo) {
    const p = geo.attributes.position.array, ix = geo.index ? geo.index.array : null, n = ix ? ix.length : p.length / 3, st = this.s * 0.5, inv = 1 / this.s, mx = this.min.x, my = this.min.y, mz = this.min.z;
    for (let t = 0; t < n; t += 3) {
      const a = (ix ? ix[t] : t) * 3, b = (ix ? ix[t + 1] : t + 1) * 3, c = (ix ? ix[t + 2] : t + 2) * 3;
      const ax = p[a], ay = p[a + 1], az = p[a + 2], ux = p[b] - ax, uy = p[b + 1] - ay, uz = p[b + 2] - az, vx = p[c] - ax, vy = p[c + 1] - ay, vz = p[c + 2] - az;
      const nu = Math.max(1, Math.ceil(Math.hypot(ux, uy, uz) / st)), nv = Math.max(1, Math.ceil(Math.hypot(vx, vy, vz) / st));
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const fu = i / nu, fv = j / nv; if (fu + fv > 1.0001) continue;
        this.set(Math.floor((ax + ux * fu + vx * fv - mx) * inv), Math.floor((ay + uy * fu + vy * fv - my) * inv), Math.floor((az + uz * fu + vz * fv - mz) * inv));
      }
    }
  }
  // walk from (x, y, z) along (dx, dy, dz) for `len`: the distance to the first full voxel, or -1. In an empty brick
  // the walk jumps straight to where the line leaves it.
  march(x, y, z, dx, dy, dz, len, step) {
    const s = this.s, inv = 1 / s, mx = this.min.x, my = this.min.y, mz = this.min.z, B = BS * s;
    let t = step * 0.5;
    while (t < len) {
      const px = x + dx * t, py = y + dy * t, pz = z + dz * t;
      const i = Math.floor((px - mx) * inv), j = Math.floor((py - my) * inv), k = Math.floor((pz - mz) * inv);
      if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return -1;   // (out of the box: nothing more to hit)
      const b = this.brick[((k >> 3) * this.by + (j >> 3)) * this.bx + (i >> 3)];
      if (b < 0) {
        const x0 = mx + (i >> 3) * B, y0 = my + (j >> 3) * B, z0 = mz + (k >> 3) * B;
        const tx = dx > 1e-9 ? (x0 + B - px) / dx : dx < -1e-9 ? (x0 - px) / dx : 1e9;
        const ty = dy > 1e-9 ? (y0 + B - py) / dy : dy < -1e-9 ? (y0 - py) / dy : 1e9;
        const tz = dz > 1e-9 ? (z0 + B - pz) / dz : dz < -1e-9 ? (z0 - pz) / dz : 1e9;
        t += Math.min(tx, ty, tz) + s * 0.02;
        continue;
      }
      if (this.pool[b * BS3 + (((k & 7) << 3) + (j & 7)) * BS + (i & 7)] === 1) return t;
      t += step;
    }
    return -1;
  }
}
// the voxels for a set of occluders, in a box (or the occluders' own box)
export function makeVoxels(occluders, size, box = null) {
  const bx = box ? box.clone() : new THREE.Box3();
  if (!box) for (const g of occluders) { g.computeBoundingBox(); bx.union(g.boundingBox); }
  const V = new Voxels(bx, size); for (const g of occluders) V.addGeometry(g);
  return V;
}

// receivers: geometries to bake (world space); occluders: geometries that cast; lights: { at, i, color, dir, reach }
//   opts: voxel (0.07 m), rays (32 round the sphere, half of them over a surface), reach (how far the corner
//   darkening looks, 0.9 m), strength (0.85), shadows (walk to each light: true), floorY (the room's floor, for
//   telling which way is up out of a grating)
export function bake(receivers, occluders, lights, opts = {}) {
  const t0 = performance.now(), size = opts.voxel ?? 0.07;
  const box = new THREE.Box3(); for (const g of occluders) { g.computeBoundingBox(); box.union(g.boundingBox); }
  for (const g of receivers) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const V = opts.V || makeVoxels(occluders, size, box);
  const r = bakeWith(receivers, V, lightBins(lights, V), opts);
  return { ...r, ms: performance.now() - t0, voxels: V.count, bricks: V.bricks, voxelBytes: V.bytes, voxelSize: size, V };
}
// the lights, as flat records, each in every 2 m floor square its reach touches (so a vertex only looks at the lights
// that can reach it)
export function lightBins(lights, V) {
  const L = lights.map((l) => ({ x: l.at[0], y: l.at[1], z: l.at[2], i: l.i, r: l.color[0], g: l.color[1], b: l.color[2], d: l.dir, reach: l.reach || 7 }));
  const BIN = 2, x0 = V.min.x, z0 = V.min.z, x1 = V.min.x + V.nx * V.s, z1 = V.min.z + V.nz * V.s;
  const bx0 = Math.floor(x0 / BIN) - 1, bz0 = Math.floor(z0 / BIN) - 1, bnx = Math.ceil((x1 - x0) / BIN) + 3, bnz = Math.ceil((z1 - z0) / BIN) + 3;
  const bins = Array.from({ length: bnx * bnz }, () => []);
  for (const l of L) for (let i = Math.max(0, Math.floor((l.x - l.reach) / BIN) - bx0); i <= Math.min(bnx - 1, Math.floor((l.x + l.reach) / BIN) - bx0); i++) for (let k = Math.max(0, Math.floor((l.z - l.reach) / BIN) - bz0); k <= Math.min(bnz - 1, Math.floor((l.z + l.reach) / BIN) - bz0); k++) bins[k * bnx + i].push(l);
  return { count: L.length, of: (x, z) => bins[Math.min(bnz - 1, Math.max(0, Math.floor(z / BIN) - bz0)) * bnx + Math.min(bnx - 1, Math.max(0, Math.floor(x / BIN) - bx0))] };
}
// bake receivers against a voxel grid and binned lights (a station bakes room by room against one shared grid)
export function bakeWith(receivers, V, bins, opts = {}) {
  const t0 = performance.now(), size = V.s, reach = opts.reach ?? 0.75, strength = opts.strength ?? 0.7, shadows = opts.shadows ?? true, sky = opts.sky ? { color: [1, 0.98, 0.95], top: 7, i: 1, ...opts.sky } : null;
  const dirs = fib(opts.rays ?? 32), step = size * 0.9, off = size * 1.6, binOf = bins.of;
  let vcount = 0, lit = 0;
  for (const geo of receivers) {
    const p = geo.attributes.position.array, n = geo.attributes.normal.array, cnt = p.length / 3, ao = new Float32Array(cnt), bk = new Float32Array(cnt * 3);
    for (let v = 0; v < cnt; v++) {
      const nx = n[v * 3], ny = n[v * 3 + 1], nz = n[v * 3 + 2], x = p[v * 3] + nx * off, y = p[v * 3 + 1] + ny * off, z = p[v * 3 + 2] + nz * off;
      // corner darkening: what share of the hemisphere is closed off nearby (the nearer, the darker)
      let occ = 0, tot = 0;
      for (const [dx, dy, dz] of dirs) {
        const c = dx * nx + dy * ny + dz * nz; if (c <= 0.05) continue;
        tot += c; const h = V.march(x, y, z, dx, dy, dz, reach, step); if (h >= 0) { const f = 1 - h / reach; occ += c * (0.35 + 0.65 * f * f); }
      }
      ao[v] = Math.max(0.42, 1 - strength * (tot > 0 ? occ / tot : 0));
      // the strips' light
      let er = 0, eg = 0, eb = 0;
      for (const l of binOf(p[v * 3], p[v * 3 + 2])) {
        let lx = l.x - p[v * 3], ly = l.y - p[v * 3 + 1], lz = l.z - p[v * 3 + 2]; const d2 = lx * lx + ly * ly + lz * lz;
        if (d2 > l.reach * l.reach) continue;
        const d = Math.sqrt(d2); lx /= d; ly /= d; lz /= d;
        const cr = lx * nx + ly * ny + lz * nz; if (cr <= 0) continue;
        let e = l.i * cr / Math.max(d2, 0.06);
        if (l.d) { const ce = -(lx * l.d[0] + ly * l.d[1] + lz * l.d[2]); e *= 0.12 + 0.88 * Math.max(0, ce); }
        const w = d / l.reach, win = (1 - w * w * w * w); e *= win * win;
        if (e < 0.004) continue;
        if (shadows && V.march(x, y, z, lx, ly, lz, d - 0.14 - off, step) >= 0) continue;
        er += e * l.r; eg += e * l.g; eb += e * l.b; lit++;
      }
      // a big room's ceiling of lights (opts.sky: { i, top, color }): light from above, as much as a few short looks
      // upward (tilted off the surface) find open air up to the ceiling. Under a catwalk, a table or a ship it is
      // shaded; a wall gets about half of what a floor gets
      if (sky) {
        let vis = 0, n = 0;
        for (const [jx, jz] of SKY_JIT) {
          let dx = nx * 0.45 + jx, dy = 1 + Math.max(0, ny) * 0.2, dz = nz * 0.45 + jz; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
          const len = (sky.top - 0.35 - y) / dy; n++;
          if (len <= 0 || V.march(x, y, z, dx, dy, dz, len, step * 1.6) < 0) vis++;
        }
        const e = sky.i * (0.55 + 0.45 * ny) * vis / n;
        er += e * sky.color[0]; eg += e * sky.color[1]; eb += e * sky.color[2];
      }
      bk[v * 3] = er; bk[v * 3 + 1] = eg; bk[v * 3 + 2] = eb;
    }
    geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); geo.setAttribute('aBake', new THREE.BufferAttribute(bk, 3));
    vcount += cnt;
  }
  return { ms: performance.now() - t0, verts: vcount, lightPaths: lit };
}

// the light at one point from every strip (no shadows): for door leaves, which move and so carry one light each
export function lightAt(pt, lights, normal = null) {
  let r = 0, g = 0, b = 0;
  for (const l of lights) {
    const lx = l.at[0] - pt.x, ly = l.at[1] - pt.y, lz = l.at[2] - pt.z, d2 = lx * lx + ly * ly + lz * lz, reach = l.reach || 7;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2), c = normal ? Math.max(0, (lx * normal.x + ly * normal.y + lz * normal.z) / d) : 0.5;
    let e = l.i * c / Math.max(d2, 0.06); if (l.dir) e *= 0.12 + 0.88 * Math.max(0, -(lx * l.dir[0] + ly * l.dir[1] + lz * l.dir[2]) / d);
    const w = d / reach, win = 1 - w * w * w * w; e *= win * win;
    r += e * l.color[0]; g += e * l.color[1]; b += e * l.color[2];
  }
  return [r, g, b];
}
