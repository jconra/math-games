// THE PLANET'S NOISE: seeded random numbers and smooth noise that repeats exactly across the ground's width, so the
// ground made from it has no seam where it meets its own copy (the ground repeats past its edges: src/planet/land.js).
// Plain numbers, no THREE: the tests run it in node, and a worker or the game can run it as it is.
//
//   rng(seed)                 a random number maker: each call gives the next number in [0, 1), the same ones for
//                             the same seed
//   hash2(i, j, seed)         one random number in [0, 1) for a pair of whole numbers (a grid cell's own number)
//   gradNoise(cells, seed)    a smooth noise (-1 .. 1, mostly within -0.7 .. 0.7) with `cells` bumps across the
//                             ground's width; read it at (u, v) in cells, any number: it repeats every `cells`
//   fbm(layers)               several noises added, each half the size of the one before: fbm({ cells, n, seed,
//                             gain, lac }) -> f(u, v) with u, v from 0 to 1 across the ground (repeating)

// mulberry32: small, fast, and good enough for scattering things
export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash2(i, j, seed = 0) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// a seed made from another seed and a name, so each part of the ground has its own numbers
export function subSeed(seed, name) {
  let h = (seed >>> 0) ^ 0x811c9dc5;
  for (let k = 0; k < name.length; k++) { h ^= name.charCodeAt(k); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// gradient noise on a lattice that wraps every `cells` (a whole number)
export function gradNoise(cells, seed) {
  const C = Math.max(1, Math.round(cells)), gx = new Float32Array(C * C), gy = new Float32Array(C * C), R = rng(seed);
  for (let k = 0; k < C * C; k++) { const a = R() * Math.PI * 2; gx[k] = Math.cos(a); gy[k] = Math.sin(a); }
  return (u, v) => {
    const fu = Math.floor(u), fv = Math.floor(v), tx = u - fu, ty = v - fv;
    let i0 = fu % C, j0 = fv % C; if (i0 < 0) i0 += C; if (j0 < 0) j0 += C;
    const i1 = i0 + 1 === C ? 0 : i0 + 1, j1 = j0 + 1 === C ? 0 : j0 + 1;
    const a = j0 * C + i0, b = j0 * C + i1, c = j1 * C + i0, d = j1 * C + i1;
    const na = gx[a] * tx + gy[a] * ty, nb = gx[b] * (tx - 1) + gy[b] * ty, nc = gx[c] * tx + gy[c] * (ty - 1), nd = gx[d] * (tx - 1) + gy[d] * (ty - 1);
    const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10), sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
    const top = na + (nb - na) * sx, bot = nc + (nd - nc) * sx;
    return (top + (bot - top) * sy) * 1.4;
  };
}

// several layers of noise: the first has `cells` bumps across the ground, each next one `lac` times as many (a whole
// number, so it still repeats) and `gain` times as tall. f(u, v): u and v from 0 to 1 across the ground.
// `upTo` / `from` (cells): only the layers that coarse, or that fine (the two halves add up to the whole), so the
// slow layers can be worked out on a coarse grid and filled in (src/planet/shapes.js field) and only the fine ones
// at every sample
export function fbm({ cells = 4, n = 5, seed = 1, gain = 0.5, lac = 2, upTo = Infinity, from = 0 }) {
  const L = [];
  let c = cells, a = 1, total = 0;
  for (let k = 0; k < n; k++) { if (c <= upTo && c >= from) L.push([gradNoise(c, seed + k * 101), c, a]); total += a; c = Math.round(c * lac); a *= gain; }
  for (const l of L) l[2] /= total;
  return (u, v) => { let s = 0; for (let k = 0; k < L.length; k++) s += L[k][0](u * L[k][1], v * L[k][1]) * L[k][2]; return s; };
}
// ridged layers: sharp crests where the noise crosses zero (hill crests, mountain spines), 0 .. 1
export function ridged({ cells = 4, n = 4, seed = 1, gain = 0.5, lac = 2 }) {
  const L = [];
  let c = cells, a = 1, total = 0;
  for (let k = 0; k < n; k++) { L.push([gradNoise(c, seed + k * 131), c, a]); total += a; c = Math.round(c * lac); a *= gain; }
  return (u, v) => {
    let s = 0, w = 1;
    for (let k = 0; k < L.length; k++) { const r = 1 - Math.abs(L[k][0](u * L[k][1], v * L[k][1])); const q = r * r * w; s += q * L[k][2]; w = Math.min(1, q * 1.6); }
    return s / total;
  };
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
