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
//                            and how rocky and how bright; EX how much grows there, the landing place, and how much
//                            of the ground the trees' crowns cover there (as it looks from afar)
//   land.trees               THE TREES, every one on the ground (it repeats, so they do too): TREE_STRIDE numbers each,
//                            x, y (where its trunk stands), z, its height (metres), which way it is turned, and which of
//                            its kind's trees it is (kind.cover.trees.kinds); a Float32Array, empty on the moon
//   land.familiar            Earth's colours this time (src/planet/kinds.js familiarOf)
//   land.palette, land.kind, land.seed, land.ms (how long it took)
//
// THE SIZE: 2048 metres across, 1024 samples (one every 2 m), and it repeats past its edges, so it has no edge to
// fall off: the Miner's top speed (40 m/s) crosses it in 51 seconds and then carries on over it again.
// x and z run from -1024 to 1024 with the middle of the ground at 0, 0; y is up.
import { rng, subSeed, hash2 } from './noise.js';
import { blur, steepness } from './shapes.js';
import { KINDS, kindById, kindOf, familiarOf, TREES } from './kinds.js';

export const WIDTH = 2048, SAMPLES = 1024;
export const LANDING = { flat: 32, edge: 52, within: 170 };   // metres: level out to `flat`, eased in over `edge` more; its middle no further than `within` from the ground's middle
// the trees: numbers per tree in land.trees; how far past the landing place's level ground the nearest trunk stands
// (about a big tree's crown, so none hangs over it); the steepest ground one stands on (degrees)
export const TREE_STRIDE = 6, TREE_CLEAR = 10, TREE_STEEP = 32;
// THE LANDING PLACE NOT A BARE CLEARING (two critics: plants and rocks began 15 to 30 m away, a cleared stage): the
// small stones and the plants up to `tall` metres grow on it as anywhere, but for where the ship sets down (within `pad` metres of its
// middle) and what is kept clear under the wreck, the pods and the way to them (the full mark: src/planet/wreck.js); the cover reads it: src/planet/cover.js
export const CLEARING = { pad: 11, kept: 0.999, tall: 1.35, gaps: 0.3, least: 0.5, thin: 1.0 };

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
  ctx.rock = new Float32Array(N * N); ctx.tone = new Float32Array(N * N); ctx.growth = new Float32Array(N * N); ctx.woods = new Float32Array(N * N);
  K.paint(ctx);
  const crown = K.cover.trees ? K.cover.trees.crown : 0;

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
    // (the landing place's mark tops out a step short of full: full is kept for what is cleared under the wreck, the pods
    // and the way to them, src/planet/wreck.js clearUnder, where nothing at all stands)
    EX[k * 4] = b(ctx.growth[k]); EX[k * 4 + 1] = Math.min(254, b(near)); EX[k * 4 + 2] = b(Math.min(1, ctx.woods[k] * crown));
    if (H[k] < minH) minH = H[k]; if (H[k] > maxH) maxH = H[k];
  }
  const trees = layTrees(ctx, K, landing);
  if (trees.length) (ctx.counts || (ctx.counts = {})).trees = trees.length / TREE_STRIDE;

  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  return finishLand({ seed, kindId: K.id, N, H, NM, EX, trees, landing, minH, maxH, craters: ctx.craters || [], counts: ctx.counts || {}, ms });
}
// the land from its numbers alone (as a worker hands them back: src/planet/worker.js), with its ways of reading itself
export function finishLand({ seed, kindId, N, H, NM, EX, trees = new Float32Array(0), landing, minH, maxH, craters = [], counts = {}, ms = 0 }) {
  const K = kindById(kindId), P = WIDTH, T = P / N, R = rng(subSeed(seed, 'palette')), familiar = familiarOf(seed, K);
  const land = {
    seed, kind: K, kindId: K.id, N, width: P, gap: T, H, NM, EX, trees, landing, minH, maxH, ms, familiar,
    palette: K.palette(R, { familiar }), craters, counts,
    heightAt: (x, z) => sampleH(H, N, P, x, z),
    normalAt: (x, z) => { const e = T, dx = (sampleH(H, N, P, x + e, z) - sampleH(H, N, P, x - e, z)) / (2 * e), dz = (sampleH(H, N, P, x, z + e) - sampleH(H, N, P, x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz); return [-dx / l, 1 / l, -dz / l]; },
    slopeAt: (x, z) => Math.acos(Math.min(1, land.normalAt(x, z)[1])) * 180 / Math.PI,
    // what grows at a point (0..1), and how rocky it is (0..1): the cover's own reading of the ground
    growthAt: (x, z) => sampleB(EX, N, P, x, z, 0), rockAt: (x, z) => sampleB(NM, N, P, x, z, 2), landingAt: (x, z) => sampleB(EX, N, P, x, z, 1),
    toneAt: (x, z) => sampleB(NM, N, P, x, z, 3) * 2 - 1,
    // the numbers alone, to hand from a worker (their buffers can be moved, not copied)
    data: () => ({ seed, kindId: K.id, N, H, NM, EX, trees, landing, minH, maxH, craters, counts, ms: land.ms }),
  };
  return land;
}

// THE TREES, laid over the whole ground once: it is cut into squares of the kind's `cell` metres (a whole number of
// them across, so they repeat with the ground), and in each a tree stands, or not, by the chance the kind's paint gave
// there (ctx.woods), somewhere inside it; none on steep ground, nor on the landing place or within TREE_CLEAR metres
// of its level ground. Which of the kind's trees each is goes by the shares the seed picked for this world (from..to),
// its size a little different each (three quarters to one and a quarter of its kind's), turned any way. It stands on
// the lowest ground round its trunk, so on a slope it doesn't float. The same seed, the same trees.
function layTrees(ctx, K, landing) {
  const T0 = K.cover.trees; if (!T0 || !T0.kinds.length) return new Float32Array(0);
  const { N, P, H, woods, seed } = ctx, n = Math.round(P / T0.cell), C = P / n, R = rng(subSeed(seed, 'trees')), sd = subSeed(seed, 'tree') | 0;
  const shares = T0.kinds.map((t) => t.share[0] + (t.share[1] - t.share[0]) * R()), total = shares.reduce((s, v) => s + v, 0);
  const hAt = (x, z) => sampleH(H, N, P, x, z), clear = landing.flat + TREE_CLEAR, out = [];
  const steep = Math.tan(TREE_STEEP * Math.PI / 180), e = 1.5;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -P / 2 + (i + hash2(i, j, sd)) * C, z = -P / 2 + (j + hash2(i, j, sd + 1)) * C;
    const si = Math.round((x + P / 2) / (P / N)) & (N - 1), sj = Math.round((z + P / 2) / (P / N)) & (N - 1);
    if (hash2(i, j, sd + 2) >= woods[sj * N + si]) continue;
    if (Math.hypot(wrapD(x - landing.x, P), wrapD(z - landing.z, P)) < clear) continue;
    if (Math.hypot(hAt(x + e, z) - hAt(x - e, z), hAt(x, z + e) - hAt(x, z - e)) / (2 * e) > steep) continue;
    let t = hash2(i, j, sd + 3) * total, k = 0; for (; k < shares.length - 1; k++) { if ((t -= shares[k]) < 0) break; }
    const kind = T0.kinds[k], height = TREES[kind.tree].height * kind.size * (0.75 + 0.5 * hash2(i, j, sd + 4));
    // (the trunk's foot reaches out about a thirtieth of the tree's height)
    const r = height / 30; let y = hAt(x, z); for (let a = 0; a < 6; a++) y = Math.min(y, hAt(x + Math.cos(a * 1.047) * r, z + Math.sin(a * 1.047) * r));
    out.push(x, y, z, height, hash2(i, j, sd + 5) * Math.PI * 2, k);
  }
  return Float32Array.from(out);
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
