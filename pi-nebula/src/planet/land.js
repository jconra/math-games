// A PLANET'S GROUND, made by the game from a seed: the same seed always makes the same ground, a new seed a new one.
// The game's maker chose it for the medical and the exploring runs (2026-11-20, MIS-1 C and MIS-2 C: "The planet's
// ground first for both", "A different one each run, made by the game"). Plain numbers, no THREE: the tests run it in
// node, and the picture of it is src/planet/ground.js.
//
//   const land = makeLand(seed, { kind })     kind: an id from src/planet/kinds.js, or none for the seed's own
//   land.heightAt(x, z)      the ground's height (metres) at any point, as the ground is drawn
//   land.normalAt(x, z)      which way the ground faces there, [x, y, z]
//   land.slopeAt(x, z)       how steep it is there, degrees
//   land.landing             THE LANDING PLACE: { x, z, y, flat, edge }: level ground within `flat` metres of its
//                            middle (a ship and the people walking out of it), easing back into the land by `edge`
//   land.H                   the heights, N x N samples across WIDTH metres (Float32Array)
//   land.NM, land.EX         what the ground is, for its picture (Uint8Array N x N x 4): NM which way it faces (x, z)
//                            and how rocky and how bright; EX how much grows there, and the landing place
//   land.palette, land.kind, land.seed, land.ms (how long it took)
//
// THE SIZE: 2048 metres across, 1024 samples (one every 2 m), and it repeats past its edges, so it has no edge to
// fall off: the Miner's top speed (40 m/s) crosses it in 51 seconds and then carries on over it again.
// x and z run from -1024 to 1024 with the middle of the ground at 0, 0; y is up.
import { rng, subSeed } from './noise.js';
import { blur, steepness } from './shapes.js';
import { KINDS, kindById, kindOf } from './kinds.js';

export const WIDTH = 2048, SAMPLES = 1024;
export const LANDING = { flat: 32, edge: 52, within: 170 };   // metres: level out to `flat`, eased in over `edge` more; its middle no further than `within` from the ground's middle

export function makeLand(seed, { kind = null, n = SAMPLES } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  seed = Math.max(1, Math.floor(Math.abs(+seed) || 1));
  const K = (kind && kindById(kind)) || kindOf(seed);
  const N = n, P = WIDTH, T = P / N, H = new Float32Array(N * N);
  const ctx = { N, P, T, H, seed };
  K.shape(ctx);

  // THE LANDING PLACE: of the spots near the middle, the one where the land is already most nearly level, made level
  const landing = flatten(ctx, findLanding(ctx));

  // what the ground is: steepness, its hollows (the land's height smoothed over 30 m), then the kind's own paint
  ctx.slope = steepness(ctx);
  ctx.low = blur(H, N, Math.round(15 / T));
  ctx.rock = new Float32Array(N * N); ctx.tone = new Float32Array(N * N); ctx.growth = new Float32Array(N * N);
  K.paint(ctx);

  // the two pictures of it: NM (which way it faces, x and z, and how rocky and bright), EX (what grows, and where
  // the landing place is, so nothing stands on it)
  const NM = new Uint8Array(N * N * 4), EX = new Uint8Array(N * N * 4), m = N - 1, b = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  let minH = Infinity, maxH = -Infinity;
  for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) {
    const dx = (H[j * N + ((i + 1) & m)] - H[j * N + ((i - 1) & m)]) / (2 * T), dz = (H[((j + 1) & m) * N + i] - H[((j - 1) & m) * N + i]) / (2 * T);
    const l = Math.sqrt(dx * dx + 1 + dz * dz);
    const x = wrapD(-P / 2 + i * T - landing.x, P), z = wrapD(-P / 2 + j * T - landing.z, P), d = Math.sqrt(x * x + z * z);
    const near = 1 - Math.min(1, Math.max(0, (d - landing.flat) / landing.edge));   // (1 on the landing place, easing out)
    // (on the landing place the ground keeps its own colours, a little quieter; nothing stands on it: src/planet/cover.js)
    NM[k * 4] = b(-dx / l * 0.5 + 0.5); NM[k * 4 + 1] = b(-dz / l * 0.5 + 0.5); NM[k * 4 + 2] = b(ctx.rock[k] * (1 - near)); NM[k * 4 + 3] = b(ctx.tone[k] * (1 - 0.6 * near) * 0.5 + 0.5);
    EX[k * 4] = b(ctx.growth[k]); EX[k * 4 + 1] = b(near);
    if (H[k] < minH) minH = H[k]; if (H[k] > maxH) maxH = H[k];
  }

  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  return finishLand({ seed, kindId: K.id, N, H, NM, EX, landing, minH, maxH, craters: ctx.craters || [], counts: ctx.counts || {}, ms });
}
// the land from its numbers alone (as a worker hands them back: src/planet/worker.js), with its ways of reading itself
export function finishLand({ seed, kindId, N, H, NM, EX, landing, minH, maxH, craters = [], counts = {}, ms = 0 }) {
  const K = kindById(kindId), P = WIDTH, T = P / N, R = rng(subSeed(seed, 'palette'));
  const land = {
    seed, kind: K, kindId: K.id, N, width: P, gap: T, H, NM, EX, landing, minH, maxH, ms,
    palette: K.palette(R), craters, counts,
    heightAt: (x, z) => sampleH(H, N, P, x, z),
    normalAt: (x, z) => { const e = T, dx = (sampleH(H, N, P, x + e, z) - sampleH(H, N, P, x - e, z)) / (2 * e), dz = (sampleH(H, N, P, x, z + e) - sampleH(H, N, P, x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz); return [-dx / l, 1 / l, -dz / l]; },
    slopeAt: (x, z) => Math.acos(Math.min(1, land.normalAt(x, z)[1])) * 180 / Math.PI,
    // what grows at a point (0..1), and how rocky it is (0..1): the cover's own reading of the ground
    growthAt: (x, z) => sampleB(EX, N, P, x, z, 0), rockAt: (x, z) => sampleB(NM, N, P, x, z, 2), landingAt: (x, z) => sampleB(EX, N, P, x, z, 1),
    toneAt: (x, z) => sampleB(NM, N, P, x, z, 3) * 2 - 1,
    // the numbers alone, to hand from a worker (their buffers can be moved, not copied)
    data: () => ({ seed, kindId: K.id, N, H, NM, EX, landing, minH, maxH, craters, counts, ms: land.ms }),
  };
  return land;
}
export { KINDS };

// the shortest way round from one point to another across the repeating ground (metres)
export const wrapD = (d, P = WIDTH) => d - P * Math.round(d / P);
// the height at any point, between the four samples round it (the ground's picture reads them the same way)
export function sampleH(H, N, P, x, z) {
  const T = P / N, fx = (x + P / 2) / T, fz = (z + P / 2) / T, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, m = N - 1;
  const i0 = ix & m, i1 = (ix + 1) & m, j0 = (iz & m) * N, j1 = ((iz + 1) & m) * N;
  const a = H[j0 + i0], c = H[j0 + i1], d = H[j1 + i0], e = H[j1 + i1];
  return (a + (c - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
}
function sampleB(A, N, P, x, z, ch) {
  const T = P / N, i = Math.round((x + P / 2) / T) & (N - 1), j = Math.round((z + P / 2) / T) & (N - 1);
  return A[(j * N + i) * 4 + ch] / 255;
}

// the spot near the middle where the land is most nearly level already (so making it level changes it least)
function findLanding(ctx) {
  const { N, P, T, H } = ctx, { flat, within } = LANDING, step = 20, r = flat + 12;
  let best = null;
  for (let z = -within; z <= within; z += step) for (let x = -within; x <= within; x += step) {
    if (Math.hypot(x, z) > within) continue;
    let s = 0, s2 = 0, n = 0;
    for (let dz = -r; dz <= r; dz += 6) for (let dx = -r; dx <= r; dx += 6) { if (dx * dx + dz * dz > r * r) continue; const h = sampleH(H, N, P, x + dx, z + dz); s += h; s2 += h * h; n++; }
    const mean = s / n, spread = Math.sqrt(Math.max(0, s2 / n - mean * mean)) + Math.hypot(x, z) * 0.004;   // (nearer the middle wins a tie)
    if (!best || spread < best.spread) best = { x, z, mean, spread };
  }
  return best;
}
// make it level: the land round the spot eased to its mean height, all the way within `flat` metres (a trace of the
// old shape left, a few centimetres, so it is not a polished floor), back to the land as it was by `flat + edge`
function flatten(ctx, spot) {
  const { N, P, T, H } = ctx, { flat, edge } = LANDING, n = Math.ceil((flat + edge) / T), ci = Math.round((spot.x + P / 2) / T), cj = Math.round((spot.z + P / 2) / T), m = N - 1;
  // the level: the mean height within the flat part
  let s = 0, c = 0;
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) { const d = Math.hypot(di, dj) * T; if (d <= flat) { s += H[((cj + dj) & m) * N + ((ci + di) & m)]; c++; } }
  const y = s / c, keep = 0.025;
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
    const d = Math.hypot(di, dj) * T; if (d > flat + edge) continue;
    const t = Math.min(1, Math.max(0, (d - flat) / edge)), w = 1 - t * t * (3 - 2 * t), k = ((cj + dj) & m) * N + ((ci + di) & m);
    H[k] = y + (H[k] - y) * (1 - w * (1 - keep));
  }
  return { x: -P / 2 + (ci & m) * T, z: -P / 2 + (cj & m) * T, y, flat, edge };
}
