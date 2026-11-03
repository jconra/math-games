// THE BAKE: worked out once when a room is built, stored in each vertex, free to draw after.
//   aAO    corner darkening (ambient occlusion: how much of the sky above a point its surroundings hide), 0..1
//   aBake  the light the glowing strips throw on it, with their shadows: the room is chopped into small cubes
//          (voxels) that are full where any surface passes, and a short walk through them from each vertex says
//          what is hidden (from the open sky round it, and from each light)
// Units: aBake is irradiance as a three.js point light gives it (intensity x cos / distance squared).
import * as THREE from 'three';

function fib(n) { // n directions spread evenly over a sphere
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * g; out.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  return out;
}

export class Voxels {
  constructor(box, size) {
    this.s = size; this.min = box.min.clone().subScalar(size * 2);
    const ext = box.max.clone().addScalar(size * 2).sub(this.min);
    this.nx = Math.ceil(ext.x / size); this.ny = Math.ceil(ext.y / size); this.nz = Math.ceil(ext.z / size);
    this.g = new Uint8Array(this.nx * this.ny * this.nz);
  }
  idx(x, y, z) {
    const i = Math.floor((x - this.min.x) / this.s), j = Math.floor((y - this.min.y) / this.s), k = Math.floor((z - this.min.z) / this.s);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return -1;
    return (k * this.ny + j) * this.nx + i;
  }
  full(x, y, z) { const i = this.idx(x, y, z); return i >= 0 && this.g[i] === 1; }
  // mark every voxel a geometry's triangles pass through (by sampling each triangle finer than a voxel)
  addGeometry(geo) {
    const p = geo.attributes.position.array, ix = geo.index ? geo.index.array : null, n = ix ? ix.length : p.length / 3, st = this.s * 0.5;
    for (let t = 0; t < n; t += 3) {
      const a = (ix ? ix[t] : t) * 3, b = (ix ? ix[t + 1] : t + 1) * 3, c = (ix ? ix[t + 2] : t + 2) * 3;
      const ax = p[a], ay = p[a + 1], az = p[a + 2], ux = p[b] - ax, uy = p[b + 1] - ay, uz = p[b + 2] - az, vx = p[c] - ax, vy = p[c + 1] - ay, vz = p[c + 2] - az;
      const nu = Math.max(1, Math.ceil(Math.hypot(ux, uy, uz) / st)), nv = Math.max(1, Math.ceil(Math.hypot(vx, vy, vz) / st));
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const fu = i / nu, fv = j / nv; if (fu + fv > 1.0001) continue;
        const q = this.idx(ax + ux * fu + vx * fv, ay + uy * fu + vy * fv, az + uz * fu + vz * fv); if (q >= 0) this.g[q] = 1;
      }
    }
  }
  // walk from (x, y, z) along (dx, dy, dz) for `len`: the distance to the first full voxel, or -1
  march(x, y, z, dx, dy, dz, len, step) {
    for (let t = step * 0.5; t < len; t += step) if (this.full(x + dx * t, y + dy * t, z + dz * t)) return t;
    return -1;
  }
}

// receivers: geometries to bake (world space); occluders: geometries that cast; lights: { at, i, color, dir, reach }
//   opts: voxel (0.07 m), rays (32 round the sphere, half of them over a surface), reach (how far the corner
//   darkening looks, 0.9 m), strength (0.85), shadows (walk to each light: true), floorY (the room's floor, for
//   telling which way is up out of a grating)
export function bake(receivers, occluders, lights, opts = {}) {
  const t0 = performance.now(), size = opts.voxel ?? 0.07, reach = opts.reach ?? 0.75, strength = opts.strength ?? 0.7, shadows = opts.shadows ?? true;
  const box = new THREE.Box3(); for (const g of occluders) { g.computeBoundingBox(); box.union(g.boundingBox); }
  for (const g of receivers) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const V = new Voxels(box, size); for (const g of occluders) V.addGeometry(g);
  const dirs = fib(opts.rays ?? 32), step = size * 0.9, off = size * 1.6;
  // the lights, as flat arrays
  const L = lights.map((l) => ({ x: l.at[0], y: l.at[1], z: l.at[2], i: l.i, r: l.color[0], g: l.color[1], b: l.color[2], d: l.dir, reach: l.reach || 7 }));
  // (each light goes in every 2 m floor square its reach touches, so a vertex only looks at the lights that can reach it)
  const BIN = 2, bx0 = Math.floor(box.min.x / BIN) - 1, bz0 = Math.floor(box.min.z / BIN) - 1, bnx = Math.ceil((box.max.x - box.min.x) / BIN) + 3, bnz = Math.ceil((box.max.z - box.min.z) / BIN) + 3;
  const bins = Array.from({ length: bnx * bnz }, () => []);
  for (const l of L) for (let i = Math.max(0, Math.floor((l.x - l.reach) / BIN) - bx0); i <= Math.min(bnx - 1, Math.floor((l.x + l.reach) / BIN) - bx0); i++) for (let k = Math.max(0, Math.floor((l.z - l.reach) / BIN) - bz0); k <= Math.min(bnz - 1, Math.floor((l.z + l.reach) / BIN) - bz0); k++) bins[k * bnx + i].push(l);
  const binOf = (x, z) => bins[Math.min(bnz - 1, Math.max(0, Math.floor(z / BIN) - bz0)) * bnx + Math.min(bnx - 1, Math.max(0, Math.floor(x / BIN) - bx0))];
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
      bk[v * 3] = er; bk[v * 3 + 1] = eg; bk[v * 3 + 2] = eb;
    }
    geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); geo.setAttribute('aBake', new THREE.BufferAttribute(bk, 3));
    vcount += cnt;
  }
  return { ms: performance.now() - t0, verts: vcount, voxels: V.g.length, voxelSize: size, lightPaths: lit, V };
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
