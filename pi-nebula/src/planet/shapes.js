// THE GROUND'S BUILDING BLOCKS, used by each kind of planet (src/planet/kinds.js) to shape its land: noise added in,
// craters stamped, a blur, the steepness. Plain numbers, no THREE.
//
// The land is a square grid of heights, `N` samples across `P` metres, that repeats past its edges (so everything
// here wraps round: a crater near one edge carries on at the other). A sample (i, j) stands at x = -P/2 + i * T,
// z = -P/2 + j * T, where T = P / N is the gap between samples. u = i / N and v = j / N run from 0 to 1 across it.
//   ctx = { N, P, T, H (Float32Array N*N, metres), seed, R (random numbers) }
import { rng, hash2, smooth } from './noise.js';

// H += f(u, v) * amp everywhere (f from noise.js: fbm, ridged, ...), times mask(k) when given
export function addField(ctx, f, amp, mask = null) {
  const { N, H } = ctx;
  for (let j = 0, k = 0; j < N; j++) { const v = j / N; for (let i = 0; i < N; i++, k++) H[k] += f(i / N, v) * amp * (mask ? mask[k] : 1); }
}
// a field of numbers worked out once (a mask, say), f(u, v) for each sample. `coarse`: worked out on a grid that many
// times coarser and filled in between (for slow, smooth fields: much quicker, and the same everywhere it is used)
// (filled in smoothly, Catmull-Rom across and then down, so heights made this way have no creases where the coarse
// grid's lines were)
export function field(ctx, f, coarse = 1) {
  const { N } = ctx, out = new Float32Array(N * N), c = Math.max(1, Math.round(coarse)), M = N / c;
  if (c === 1 || M !== Math.floor(M)) { for (let j = 0, k = 0; j < N; j++) { const v = j / N; for (let i = 0; i < N; i++, k++) out[k] = f(i / N, v); } return out; }
  const g = new Float32Array(M * M);
  for (let j = 0, k = 0; j < M; j++) for (let i = 0; i < M; i++, k++) g[k] = f(i / M, j / M);
  // the four weights for each of the c places between two coarse samples
  const W = []; for (let s = 0; s < c; s++) { const t = s / c, t2 = t * t, t3 = t2 * t; W.push([(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]); }
  const rows = new Float32Array(M * N), wr = (a) => ((a % M) + M) % M;
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const i0 = Math.floor(i / c), w = W[i - i0 * c], r = j * M;
    rows[j * N + i] = g[r + wr(i0 - 1)] * w[0] + g[r + i0 % M] * w[1] + g[r + wr(i0 + 1)] * w[2] + g[r + wr(i0 + 2)] * w[3];
  }
  for (let j = 0; j < N; j++) {
    const j0 = Math.floor(j / c), w = W[j - j0 * c], a = wr(j0 - 1) * N, b = (j0 % M) * N, d = wr(j0 + 1) * N, e = wr(j0 + 2) * N;
    for (let i = 0, k = j * N; i < N; i++, k++) out[k] = rows[a + i] * w[0] + rows[b + i] * w[1] + rows[d + i] * w[2] + rows[e + i] * w[3];
  }
  return out;
}
// add a field in (H += F * amp, times the mask when given)
export function addArray(ctx, F, amp = 1, mask = null) { const { H } = ctx; for (let k = 0; k < H.length; k++) H[k] += F[k] * amp * (mask ? mask[k] : 1); }
// a box blur `r` samples wide each way (three passes are close to a soft round blur), wrapping round the edges
export function blur(src, N, r, passes = 2) {
  let a = Float32Array.from(src), b = new Float32Array(N * N);
  const R = Math.max(1, Math.round(r)), w = 1 / (2 * R + 1);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < N; j++) {                       // along the rows
      const row = j * N; let s = 0;
      for (let d = -R; d <= R; d++) s += a[row + ((d % N) + N) % N];
      for (let i = 0; i < N; i++) { b[row + i] = s * w; s += a[row + (i + R + 1) % N] - a[row + ((i - R) % N + N) % N]; }
    }
    for (let i = 0; i < N; i++) {                       // down the columns
      let s = 0;
      for (let d = -R; d <= R; d++) s += b[(((d % N) + N) % N) * N + i];
      for (let j = 0; j < N; j++) { a[j * N + i] = s * w; s += b[((j + R + 1) % N) * N + i] - b[(((j - R) % N + N) % N) * N + i]; }
    }
  }
  return a;
}
// how steep the ground is at each sample: rise over run (0 level, 1 is 45 degrees)
export function steepness(ctx) {
  const { N, H, T } = ctx, out = new Float32Array(N * N), m = N - 1;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = (H[j * N + ((i + 1) & m)] - H[j * N + ((i - 1) & m)]) / (2 * T), dz = (H[((j + 1) & m) * N + i] - H[((j - 1) & m) * N + i]) / (2 * T);
    out[j * N + i] = Math.sqrt(dx * dx + dz * dz);
  }
  return out;
}

// ── craters ──────────────────────────────────────────────────────────────────────────────────────────────────────
// smooth minimum and maximum (k: how far round the corner is softened)
const smin = (a, b, k) => { const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
// a crater's shape across, in its own radii (x: distance from its middle over its radius): a bowl, a raised rim
// that falls away outside it, a flat floor in the big ones and a peak in the middle of the biggest. In radii, times
// the radius and the crater's depth share it is metres.
export function craterShape(x, c) {
  const cavity = x * x - 1, rx = Math.min(x - 1 - c.rimWidth, 0), rim = c.rimSteep * rx * rx;
  let s = smin(smax(cavity, c.floor, c.soft), rim, c.soft);
  if (c.peak > 0) s += c.peak * Math.exp(-(x * x) / 0.03);
  return s;
}
// a list of craters of many sizes for the whole ground: as many small ones as fit, fewer big ones. Each size band
// (radii r .. 2r) covers about `cover` of the ground. Old ones are worn down: shallower, softer, no bright rays.
//   { min, max (radii, metres), cover, keep(x, z, r) -> 0..1 (the share kept there, say fewer in the dark plains) }
export function craterList(ctx, { min = 3, max = 300, cover = 0.5, seed = 1, keep = null, freshShare = 0.18 }) {
  const R = rng(seed), list = [], A = ctx.P * ctx.P;
  for (let r0 = min; r0 < max; r0 *= 2) {
    let covered = 0;
    const top = Math.min(r0 * 2, max), want = cover * A * (top >= max ? (Math.log(top / r0) / Math.LN2) : 1);
    while (covered < want) {
      const r = r0 * Math.pow(top / r0, R()), x = (R() - 0.5) * ctx.P, z = (R() - 0.5) * ctx.P;
      covered += Math.PI * r * r * 2.6;
      if (keep && R() > keep(x, z, r)) continue;
      const age = R(), fresh = age < freshShare;
      // (the worn ones from a little worn to nearly gone; the fresh ones deep and sharp)
      const wear = fresh ? 1 : 0.22 + 0.62 * Math.pow(R(), 0.7);
      const big = smooth(60, 180, r);
      list.push({
        x, z, r, fresh, wear,
        depth: (0.4 - 0.2 * big) * wear,                    // the bowl's depth in radii (a fifth of the width when fresh and small)
        rimWidth: 0.55 + 0.25 * R(), rimSteep: 0.55 + 0.35 * R(),
        floor: -1 + 0.45 * big - 0.1 * R() * big,           // the big ones have flat floors
        peak: r > 110 && R() < 0.75 ? 0.25 + 0.2 * R() : 0, // and a peak in the middle
        soft: 0.12 + 0.45 * (1 - wear),
        rays: fresh && r > 24 && R() < 0.6 ? 0.5 + 0.5 * R() : 0, spin: R() * 6.283,
      });
    }
  }
  list.sort((a, b) => b.r - a.r);   // the big ones first, so the small ones land in them and on their rims
  return list;
}
// stamp the craters into the heights (wrapping round the edges). `fresh` (optional, Float32Array N*N) gets how much
// fresh, bright crater there is at each sample: the rays round the young craters, and their rims
export function stampCraters(ctx, list, fresh = null) {
  const { N, P, T, H } = ctx, m = N - 1;
  for (const c of list) {
    const reach = c.r * (c.rays ? 4.5 : 1 + c.rimWidth + 0.15), n = Math.ceil(reach / T);
    const ci = (c.x + P / 2) / T, cj = (c.z + P / 2) / T, i0 = Math.round(ci), j0 = Math.round(cj), k = c.r * c.depth;
    const lobes = 11 + Math.floor(c.spin * 3), ray = c.rays, out = 1 + c.rimWidth + 0.15, far2 = (ray ? 4.5 : out) ** 2 * c.r * c.r;
    for (let dj = -n; dj <= n; dj++) {
      const z = (j0 + dj - cj) * T, jj = ((j0 + dj) & m) * N;
      for (let di = -n; di <= n; di++) {
        const xx = (i0 + di - ci) * T, d2 = xx * xx + z * z;
        if (d2 > far2) continue;
        const x = Math.sqrt(d2) / c.r;
        if (x > out && !(ray && fresh)) continue;
        const kk = jj + ((i0 + di) & m);
        if (x <= out) H[kk] += craterShape(x, c) * k;
        if (fresh && c.fresh) {
          // the bright rays: streaks out from the rim, thinning out with distance
          let f = x < 1.25 ? 0.55 + 0.45 * smooth(0.6, 1.05, x) : 0;
          if (ray && x > 0.9 && x < 4.5) {
            const a = Math.atan2(z, xx) + c.spin, s = Math.sin(a * lobes) * 0.5 + Math.sin(a * (lobes * 2.3 + 1) + 1.7) * 0.35 + Math.sin(a * 5 + 0.4) * 0.3;
            f = Math.max(f, ray * smooth(0.25, 0.85, s) * Math.pow(Math.max(0, 1 - (x - 1) / 3.5), 1.6) * smooth(0.9, 1.3, x));
          }
          if (f > fresh[kk]) fresh[kk] = f;
        }
      }
    }
  }
}

// a seeded pick from a list of [weight, value]
export function pick(R, list) { let t = list.reduce((s, [w]) => s + w, 0) * R(); for (const [w, v] of list) { if ((t -= w) <= 0) return v; } return list[list.length - 1][1]; }
export { hash2 };
