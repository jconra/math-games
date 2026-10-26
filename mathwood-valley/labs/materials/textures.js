// THE LAB'S TEXTURES, DRAWN IN CODE AT LOAD (nothing is downloaded): small canvases turned into three.js textures.
//
//  wood     512 x 1024 a TRIM SHEET: 12 board strips (64 px tall each, the full width, so they tile along their length)
//                      with grain, knots, a nail every repeat and a bevelled edge, then 8 end-grain squares at the bottom.
//                      Every board, post, rail and shingle in the cabin points its UVs at one strip of this one picture.
//                      Four looks (WOOD_LOOKS): rustic planks, knotty, cathedral grain, and the first straight-grain one.
//  woodN    512 x 1024 its normal map (the bevels, grain, knots, checks, nail heads, end-grain rings), from a height map
//  stone    256 x 256  tiling rock, and stoneN its normal map. Five looks (STONE_LOOKS): fieldstone, granite, sandstone,
//                      river rock, and the first veined one.
//  ground   256 x 256  tiling grass
//  noise    256 x 256  four kinds of tiling noise in R G B A, read by the weathering shader (weather.js) in world space
//  decals              small stamps (sign, horseshoe, stain, poster), transparent round the edges
//
// A texture's memory on the graphics card is width x height x 4 bytes, plus a third more for its mipmaps (the smaller
// copies used far away). That is what the lab's "texture memory" adds up.

import * as THREE from 'three';

// ── small helpers: a seeded random, tiling value noise ────────────────────────────────────────────────────────────────
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
// value noise on a lattice that repeats every px by py cells (so the picture tiles)
function vnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
  const m = (v, p) => ((v % p) + p) % p;
  const a = hash(m(x0, px), m(y0, py), seed), b = hash(m(x0 + 1, px), m(y0, py), seed);
  const c = hash(m(x0, px), m(y0 + 1, py), seed), d = hash(m(x0 + 1, px), m(y0 + 1, py), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// fractal noise: octaves of value noise, each twice as fine and half as strong; u, v in 0..1 across the tile
function fbm(u, v, px, py, oct, seed) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(u * px, v * py, px, py, seed + o * 17); tot += amp; amp *= 0.5; px *= 2; py *= 2; }
  return s / tot;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// a normal map from a height map (heights 0..1, w x h), wrapping in x (and y when wrapY), strength = how steep
function normalsFrom(H, w, h, strength, wrapY) {
  const out = new Uint8ClampedArray(w * h * 4);
  const at = (x, y) => { x = (x + w) % w; y = wrapY ? (y + h) % h : Math.max(0, Math.min(h - 1, y)); return H[y * w + x]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    // canvas rows run down, the texture's v runs up (flipY), so green (the v slope) takes +dy
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}
function canvasOf(w, h, px) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  if (px) { const g = c.getContext('2d'); const img = g.createImageData(w, h); img.data.set(px); g.putImageData(img, 0, 0); }
  return c;
}
function tex(canvas, { srgb = true, repeat = true, repeatT = repeat, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  return t;
}

// ── more helpers: a smooth step, cellular noise ───────────────────────────────────────────────────────────────────────
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
// cellular noise: one jittered point per cell of an n x n grid that wraps (so the picture tiles). f1, f2 are the distances
// (in cells) to the nearest and second-nearest point, id a number 0..1 that belongs to the nearest point's cell
const CELL = { f1: 0, f2: 0, id: 0 };
function cells(u, v, n, seed, jit = 0.9) {
  const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const dx = x - cx - 0.5 - (hash(wx, wy, seed) - 0.5) * jit, dy = y - cy - 0.5 - (hash(wx, wy, seed + 1) - 0.5) * jit;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < f1) { f2 = f1; f1 = d; id = hash(wx, wy, seed + 2); } else if (d < f2) f2 = d;
  }
  CELL.f1 = f1; CELL.f2 = f2; CELL.id = id;
  return CELL;
}

// soft round blotches: one disc per cell of an n x n grid (wrapping), each its own size, shade (s, -1..1) and warmth (w)
const BLOB = { s: 0, w: 0 };
function blobs(u, v, n, seed) {
  const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y);
  let s = 0, w = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const d = Math.hypot(x - cx - 0.5 - (hash(wx, wy, seed) - 0.5) * 0.8, y - cy - 0.5 - (hash(wx, wy, seed + 1) - 0.5) * 0.8);
    const rad = 0.3 + 0.45 * hash(wx, wy, seed + 2), k = 1 - sstep(rad * 0.45, rad, d);
    if (k > 0) { s += k * (hash(wx, wy, seed + 3) * 2 - 1); w += k * (hash(wx, wy, seed + 4) - 0.5); }
  }
  BLOB.s = s; BLOB.w = w;
  return BLOB;
}

// ── the wood trim sheet ───────────────────────────────────────────────────────────────────────────────────────────────
// 512 px wide (1.2 m of a board's length, tiling), 1024 tall:
//   rows   0-767  12 board strips of 64 px (a board's width)
//   rows 768-895  4 end-grain squares of 128 px for logs and beams: a round end, bark in the corners
//   rows 896-959  2 shake strips of 32 px: split, not sawn, so straight grain and no knots
//   rows 960-1023 8 end-grain squares of 64 px for boards
// A strip is 64 px across whatever the board's width, so on a 28 cm log a pixel across it is about twice as long as a
// pixel along it (ASP): anything meant to look round on a log is drawn twice as wide as it is tall.
const BOARD_ROWS = Array.from({ length: 12 }, (_, s) => [s * 64, 64]);
export const WOOD = {
  w: 512, h: 1024, strip: 64, strips: 12, repeatM: 1.2,
  rows: [...BOARD_ROWS, [896, 32], [928, 32]],                                   // strip -> [first row, rows]
  ends: [...[0, 1, 2, 3].map((i) => [i * 128, 768, 128]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i * 64, 960, 64])],   // [x, y, size]
  logEnds: 4, shake: 12,
};
const ASP = 2;
// the looks the panel offers. The first is the default.
export const WOOD_LOOKS = {
  rustic: { label: 'Rustic planks', note: 'muted silver-brown, warm amber where worn, wavy grain, big ringed knots, long thin cracks, scorched patches' },
  knotty: { label: 'Knotty', note: 'knots of every size, some with rings round them, a knot hole or two, checks' },
  cathedral: { label: 'Cathedral grain', note: 'the nested arches a flat-sawn board shows, a few knots' },
  straight: { label: 'Straight grain (first look)', note: 'wavy stripes, the odd tiny knot' },
};
// strip colours: weathered pine and fir, a couple greyed by the sun, two rough-sawn (strips 10, 11)
const STRIP_COL = [[166, 136, 104], [150, 122, 94], [176, 144, 108], [142, 120, 98], [160, 136, 110], [136, 112, 88],
  [170, 138, 102], [150, 132, 114], [158, 126, 96], [144, 126, 110], [148, 120, 92], [138, 114, 90]];
// warmer, browner boards, each its own shade
const STRIP_WARM = [[170, 132, 98], [152, 116, 86], [178, 140, 102], [146, 114, 88], [164, 130, 98], [140, 106, 80],
  [174, 136, 98], [154, 124, 100], [162, 124, 90], [148, 120, 98], [152, 116, 86], [142, 110, 84]];
// the rustic planks: old weathered wood, a muted silver-brown (about #70604e), the same hue on every strip and only the
// shade changing, so neighbouring boards don't jump colour; warm amber only where the grey has worn off (below)
const STRIP_RUSTIC = [1, 0.9, 1.07, 0.86, 0.97, 0.83, 1.04, 0.93, 0.96, 0.88, 0.91, 0.85].map((k) => [124 * k, 104 * k, 84 * k]);
// how each new look sets up its strips: knots per strip (min, max) and their size (across-radius, px), how many rings
// they pull round them, the share of strips cut near the heart of the log (cathedral arches), ring spacing across the
// board (px), how much scorched staining, sun-bleaching, cracks
const WOOD_STYLE = {
  rustic: { knots: [1, 2], kSize: [2.6, 4.6], kRing: 1, feature: true, holes: 0.06, cat: 0.15, ring: [3.8, 5.2], fine: 0.3, stain: 0.6, scorch: 0.55, bleach: 1, amber: 1, checks: [1, 2], kCheck: 0.6, col: STRIP_RUSTIC },
  knotty: { knots: [4, 7], kSize: [1.6, 8.5], kRing: 1.2, holes: 0.18, cat: 0.25, ring: [4.5, 7.5], fine: 0.35, stain: 0.35, scorch: 0.3, bleach: 0.4, checks: [1, 3], kCheck: 0.4, col: STRIP_COL },
  cathedral: { knots: [0, 2], kSize: [1.6, 4], kRing: 0.8, holes: 0, cat: 0.9, ring: [4.2, 7], fine: 0.35, stain: 0.3, scorch: 0.3, bleach: 0.45, checks: [0, 2], kCheck: 0.3, col: STRIP_WARM },
};

// the first look: grain lines from warped stripes, the odd tiny knot. Drawn in the old 32-row units (Y) at twice the rows.
function drawStraight(put) {
  const S = WOOD.w, SH = WOOD.strip, k2 = SH / 32, R = rng(7);
  for (let s = 0; s < WOOD.strips; s++) {
    const y0 = s * SH, base = STRIP_COL[s], rough = s >= 10, seed = 100 + s * 31;
    const lines = 5 + R() * 5, warpAmt = 0.5 + R() * 0.9;
    const knots = []; const nk = Math.floor(R() * 2.4);
    for (let k = 0; k < nk; k++) knots.push({ x: 40 + R() * 160 + (k ? 256 : 0), y: 7 + R() * 18, r: 2.5 + R() * 3.5 });
    // (its slow wobble on a coarse grid, read back in between: the same picture, worked out at a sixth of the points)
    const wob = coarse(S, SH, 4, 2, (u, tt) => { const t = ((tt * SH + 0.5) / k2 - 0.5) / 32; return fbm(u, t * 0.3, 3, 1, 3, seed) * warpAmt + fbm(u, t, 9, 2, 2, seed + 5) * 0.15; });
    for (let yy = 0; yy < SH; yy++) {
      const Y = (yy + 0.5) / k2 - 0.5, t = Y / 32;
      for (let x = 0; x < S; x++) {
        const u = x / S;
        let warp = wob(x, yy);
        let dk = 0;
        for (const k of knots) {   // a knot pushes the grain round it and is dark at its heart
          let dx = x - k.x; if (dx > S / 2) dx -= S; if (dx < -S / 2) dx += S;
          const d = Math.hypot(dx / 2.2, Y - k.y); warp += Math.max(0, 1 - d / (k.r * 4)) * 0.6 * Math.sign(Y - k.y || 1);
          dk = Math.max(dk, clamp01(1.4 - d / k.r));
        }
        const g = t * lines + warp, ring = g - Math.floor(g), late = Math.pow(Math.sin(ring * Math.PI), 6);   // the dark late-wood lines
        const streak = fbm(u, t, 48, 4, 2, seed + 9);                 // fine streaks along the board
        let v = 0.86 + 0.14 * streak - 0.17 * late - 0.5 * dk * dk;
        if (rough) v *= 0.93 + 0.07 * Math.sin((x + Math.sin(Y * 0.4) * 3) * 0.9);   // saw marks across a rough board
        let h = 0.6 - 0.18 * late + 0.06 * streak - 0.25 * dk;
        // the bevelled edges: the strip's top and bottom rows fall away (dark gap below, a lit lip above)
        const e = Math.min(yy, SH - 1 - yy) / k2;
        if (e < 3) { const f = e / 3; h *= 0.3 + 0.7 * f; v *= e < 0.75 ? 0.55 : 0.8 + 0.2 * f; }
        let r = base[0] * v, gg = base[1] * v, b = base[2] * v;
        // a nail where the board crosses a stud (u = 0.5 of every repeat), its rust run down the board
        const nx = x - 256, ny = Y - 22, nd = Math.hypot(nx, ny);
        if (nd < 3.2) { const f = nd / 3.2; r = 70 - 30 * f; gg = 66 - 30 * f; b = 62 - 30 * f; h = 0.95 - 0.3 * f * f; }
        else if (nd < 6 || (Math.abs(nx) < 2.5 && ny > 0 && ny < 9)) { const f = 0.75; r *= f + 0.06; gg *= f; b *= f * 0.85; }
        put(x, y0 + yy, r, gg, b, h);
      }
    }
  }
  // the end grain: rings round an off-centre heart, a radial crack or two (drawn on a 128 plan, scaled to each square)
  for (let k = 0; k < WOOD.ends.length; k++) {
    const [ox, oy, sz] = WOOD.ends[k], sc = 128 / sz;
    const cx = 64 + (R() - 0.5) * 70, cy = 64 + (R() - 0.5) * 70, ringW = 3.5 + R() * 2.5, seed = 900 + k;
    const cracks = [R() * Math.PI * 2, R() * Math.PI * 2];
    for (let yy = 0; yy < sz; yy++) for (let xx = 0; xx < sz; xx++) {
      const X = xx * sc, Y = yy * sc, dx = X - cx, dy = Y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const g = (d + fbm(X / 128, Y / 128, 4, 4, 2, seed) * 6) / ringW, ring = Math.pow(Math.sin((g - Math.floor(g)) * Math.PI), 8);
      let crack = 0; for (const c of cracks) if (d > 8 && angDiff(a, c) * d < 1.3 * sc) crack = 1;
      const v = (0.78 - 0.16 * ring - 0.1 * (d / 90)) * (1 - 0.55 * crack);
      const e = Math.min(X, Y, 127 - X, 127 - Y), lip = e < 3 ? 0.75 + 0.08 * e : 1;
      put(ox + xx, oy + yy, 150 * v * lip, 112 * v * lip, 76 * v * lip, 0.6 - 0.1 * ring - 0.4 * crack);
    }
  }
}

// a smooth noise worked out on a coarse grid (every sx by sy px, wrapping along x) and read back in between: the slow
// noises don't need working out at every pixel
function coarse(S, SH, sx, sy, f) {
  const nx = S / sx, ny = Math.ceil(SH / sy) + 1, A = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) A[j * nx + i] = f(i * sx / S, j * sy / SH);
  return (x, y) => {
    const fx = x / sx, fy = y / sy, i0 = Math.floor(fx), j0 = Math.min(ny - 2, Math.floor(fy)), tx = fx - i0, ty = fy - j0, i1 = (i0 + 1) % nx;
    const a = A[j0 * nx + i0], b = A[j0 * nx + i1], c = A[(j0 + 1) * nx + i0], d = A[(j0 + 1) * nx + i1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
// the angle between two directions, 0..PI
const angDiff = (a, b) => { const d = (((a - b) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };

// the new looks. A flat-sawn board is a slice through a log's growth rings (cylinders round the heart). Across the
// board the rings sit at distance r = sqrt((y - heart)^2 + depth^2) from the heart. Cut well off the heart (most
// strips) the lines run along the board, waving where the slice wanders; cut near it (a few strips), each ring closes
// into an arch where the slice dips toward the heart. A knot is a branch through the rings: it raises the ring count in
// a small patch round it, so the lines close into a few tight rings hugging it and bend round it, back to straight
// within about three times its radius.
function drawBoards(put, look) {
  const st = WOOD_STYLE[look], S = WOOD.w, SH = WOOD.strip, G = new Float32Array(S * SH), lk = { rustic: 0, knotty: 1, cathedral: 2 }[look];
  const FIB = new Float32Array(S * 128);
  // (fibres no finer than 13 px along: finer, they shimmer on a wall seen from a few metres)
  for (let y = 0; y < 128; y++) for (let x = 0; x < S; x++) FIB[y * S + x] = fbm(x / S, y / 128, 40, 12, 2, 2900 + lk);
  // the ring count at a point between pixels (for following a crack along the grain)
  const gAt = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.max(0, Math.min(SH - 2, Math.floor(y))), fx = x - x0, fy = Math.max(0, Math.min(1, y - y0));
    const xa = ((x0 % S) + S) % S, xb = (xa + 1) % S;
    const a = G[y0 * S + xa], b = G[y0 * S + xb], c = G[(y0 + 1) * S + xa], d = G[(y0 + 1) * S + xb];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  for (let s = 0; s < WOOD.strips; s++) {
    const R = rng(4000 + s * 131 + lk * 7919), y0 = s * SH, rough = s >= 10, seed = 2000 + s * 37 + lk * 1000;
    const base = st.col[s];
    const cat = R() < st.cat, ring = mix(st.ring[0], st.ring[1], R());
    // the heart's line: inside the board (arches) or off one side (wavy, gently curving lines)
    const yc = cat ? SH * (0.3 + 0.4 * R()) : SH * 0.5 + (R() < 0.5 ? -1 : 1) * SH * (1.3 + 1.4 * R());
    const d0 = cat ? ring * (2.5 + 2 * R()) : ring * (2 + 3 * R()), dA = cat ? ring * (4 + 3 * R()) : ring * (1.2 + 1.8 * R());
    const nd = cat ? 1 : 1 + Math.floor(R() * 3), wav = cat ? 1.5 + R() * 2.5 : 3 + R() * 6, nw = 2 + Math.floor(R() * 4), ph = R();
    const depth = new Float32Array(S), yh = new Float32Array(S), edgeN = new Float32Array(S), JIT = new Float32Array(256);
    for (let i = 0; i < 256; i++) JIT[i] = hash(i, 0, seed + 21);      // each year's ring a little wider or narrower
    for (let x = 0; x < S; x++) {
      const u = x / S;
      if (cat) {
        const p = (u * nd + ph) % 1, w = p < 0.78 ? p / 0.78 : (1 - p) / 0.22;
        depth[x] = Math.abs(d0 * 0.3 + dA * 1.6 * w * w * (3 - 2 * w) + dA * (fbm(u, 0.5, 4, 1, 2, seed + 1) - 0.5) * 0.8);
      } else depth[x] = Math.abs(d0 + dA * (fbm(u, 0.5, nd, 1, 3, seed + 1) - 0.5) * 2.6);
      yh[x] = yc + wav * (fbm(u, 0.5, nw, 1, 2, seed + 2) - 0.5) * 2;
      edgeN[x] = (fbm(u, 0.5, 30, 1, 1, seed + 19) - 0.5) * 1.5;
    }
    // the slow noises, on coarse grids: the wobble of the lines, their unevenness, the stains, the bleached patches
    const wob = coarse(S, SH, 4, 4, (u, t) => fbm(u, t * 0.5, 5, 2, 2, seed + 3));
    const unev = coarse(S, SH, 2, 2, (u, t) => fbm(u, t, 12, 3, 2, seed + 4));
    const fineW = coarse(S, SH, 2, 2, (u, t) => fbm(u, t, 24, 4, 2, seed + 6));
    const stainN = coarse(S, SH, 4, 4, (u, t) => fbm(u, t * 0.6, 6, 2, 3, seed + 11) + (fbm(u, t, 20, 4, 2, seed + 12) - 0.5) * 0.15);
    const bleachN = coarse(S, SH, 8, 4, (u, t) => fbm(u, t * 0.5, 4, 2, 3, seed + 13));
    const amberN = coarse(S, SH, 4, 2, (u, t) => fbm(u, t, 7, 5, 3, seed + 16));      // streaks along the grain
    const scorchN = coarse(S, SH, 2, 2, (u, t) => fbm(u, t, 40, 4, 2, seed + 14));
    // where along each long edge the scorch is (in patches, not the whole length): one noise for the top edge, one for the bottom
    const scTop = new Float32Array(S), scBot = new Float32Array(S);
    for (let x = 0; x < S; x++) { scTop[x] = sstep(0.48, 0.62, fbm(x / S, 0.2, 5, 1, 2, seed + 31)); scBot[x] = sstep(0.48, 0.62, fbm(x / S, 0.7, 5, 1, 2, seed + 37)); }
    // the knots: across-radius ra in px, stretched along the grain; a ring-count peak A round it, gone by 3 radii.
    // A look with `feature` has one big knot on every strip (once every 1.2 m of board): a dark core, a brown halo and
    // five or six wide rings round it, bold enough to read from across the yard, not only close up
    const knots = [], nk = st.knots[0] + Math.floor(R() * (st.knots[1] - st.knots[0] + 1)) + (st.feature ? 1 : 0);
    for (let k = 0; k < nk; k++) {
      const feat = st.feature && k === 0, big = R();
      const ra = feat ? mix(8, 10.5, R()) : big < 0.5 ? mix(st.kSize[0], st.kSize[0] + 1.6, R()) : mix(st.kSize[0] + 1.2, st.kSize[1], R());
      const kn = { x: (k + 0.15 + R() * 0.7) * S / nk, y: feat ? SH * (0.4 + 0.2 * R()) : 12 + R() * (SH - 24), ra, str: 1 + R() * 0.65, hole: !feat && R() < st.holes, dead: R() < 0.45, feat };
      kn.A = (feat ? 4.6 + R() * 1.4 : 2.2 + ra * 0.15) * st.kRing * (R() < 0.5 ? 1 : -1); kn.reach = 3 * ra * ASP * kn.str * 1.3;
      knots.push(kn);
    }
    // cracks along the grain: half the knots have one running out of them, and a crack or two of their own
    const checks = [];
    const addCheck = (x0, y, dir, L, w) => checks.push({ x0, y, dir, L, w });
    // (20 to 60 cm long: 85 to 260 px)
    for (const kn of knots) if (R() < st.kCheck) { const dir = R() < 0.5 ? -1 : 1; addCheck(kn.x + dir * kn.ra * ASP * kn.str * 1.1, kn.y + (R() - 0.5) * kn.ra * 0.6, dir, 85 + R() * 175, 0.5 + R() * 0.45); }
    const nc = st.checks[0] + Math.floor(R() * (st.checks[1] - st.checks[0] + 1));
    for (let c = 0; c < nc; c++) addCheck(R() * S, 10 + R() * (SH - 20), R() < 0.5 ? -1 : 1, 85 + R() * 175, 0.45 + R() * 0.5);
    // pass 1: the ring count everywhere on the strip
    for (let yy = 0; yy < SH; yy++) {
      for (let x = 0; x < S; x++) {
        const dy = yy - yh[x] + (wob(x, yy) - 0.5) * 5;
        let g = Math.sqrt(dy * dy + depth[x] * depth[x]) / ring + (unev(x, yy) - 0.5) * 0.5;
        for (let ki = 0; ki < knots.length; ki++) {
          const kn = knots[ki];
          let dx = x - kn.x; if (dx > S / 2) dx -= S; else if (dx < -S / 2) dx += S;
          if (dx > kn.reach || dx < -kn.reach) continue;
          const ex = dx / (ASP * kn.str * 1.3), ey = yy - kn.y, q = Math.sqrt(ex * ex + ey * ey) / kn.ra;
          if (q < 3) { const t = q / 0.8, wdw = 1 - (q / 3) * (q / 3); g += kn.A * Math.exp(-t) * (1 + t) * wdw * wdw; }   // gone by 3 radii
        }
        G[yy * S + x] = g;
      }
    }
    // the cracks follow the grain: from its start, step along the board keeping to the same ring (the same ring count)
    for (const c of checks) {
      const n = Math.ceil(c.L), path = new Float32Array(n + 1), g0 = gAt(c.x0, c.y);
      let y = c.y;
      for (let i = 0; i <= n; i++) {
        const x = c.x0 + c.dir * i;
        let best = y, bd = Infinity;
        for (let dy = -1.2; dy <= 1.2; dy += 0.2) { const yy = y + dy; if (yy < 3 || yy > SH - 4) continue; const d = Math.abs(gAt(x, yy) - g0); if (d < bd) { bd = d; best = yy; } }
        y = best; path[i] = y;
      }
      // smoothed, so it wanders with the grain instead of stepping where it crosses the rings round a knot
      const sm = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) { let t = 0, w = 0; for (let j = Math.max(0, i - 6); j <= Math.min(n, i + 6); j++) { t += path[j]; w++; } sm[i] = t / w; }
      c.path = sm; c.xa = c.dir > 0 ? c.x0 : c.x0 - n;
    }
    // pass 2: colour and height
    for (let yy = 0; yy < SH; yy++) {
      const t = yy / SH, e = Math.min(yy, SH - 1 - yy), edgeK = 1 - sstep(0, 0.32, e / SH);
      for (let x = 0; x < S; x++) {
        const u = x / S, g = G[yy * S + x];
        // how far apart the lines are here: where they crowd closer than ~3 px, fade them to their average (no shimmer)
        const gx = (G[yy * S + ((x + 1) % S)] - G[yy * S + ((x + S - 1) % S)]) * 0.5;
        const gy = (G[Math.min(SH - 1, yy + 1) * S + x] - G[Math.max(0, yy - 1) * S + x]) * 0.5, grad = Math.sqrt(gx * gx + gy * gy);
        // a ring: pale early wood darkening into the late wood, then a sharp step to the next ring's early wood
        const jx = g * 0.7 + 64, ji = Math.floor(jx), jf = jx - ji, ja = JIT[ji & 255], jt = jf * jf * (3 - 2 * jf);
        const gj = g + 0.6 * (ja + (JIT[(ji + 1) & 255] - ja) * jt - 0.5), f = gj - Math.floor(gj);   // uneven years
        // (the sharp step is spread over at least a pixel's worth of ring, so a line at a slant doesn't come out in steps)
        const late = mix(sstep(0.5, 0.92, f) * (1 - sstep(1 - Math.max(0.05, grad * 1.3), 1, f)), 0.3, sstep(0.36, 0.7, grad));
        // a fainter line between two rings (only where the rings are wide apart: nothing finer than ~4 px, or it shimmers)
        const g2 = g * 2 + 0.5 + (fineW(x, yy) - 0.5) * 0.8, c2 = 0.5 - 0.5 * Math.cos((g2 - Math.floor(g2)) * Math.PI * 2);
        const fine = mix(c2 * c2, 0.37, sstep(0.07, 0.13, grad));
        const streak = FIB[((yy + s * 23) % 128) * S + ((x + s * 97) % S)];      // fibres along the board (one field, each strip its own window)
        // stained patches, more of them along the board's edges; sun-bleached grey patches elsewhere
        const sn = stainN(x, yy) + 0.3 * edgeK * st.stain;
        const stain = sstep(0.56, 0.8, sn) * st.stain, burn = sstep(0.82, 0.97, sn) * st.stain;
        // (round a feature knot the rings are drawn bolder)
        let fk = 0;
        for (let ki = 0; ki < knots.length; ki++) { const kn = knots[ki]; if (!kn.feat) continue; let dx = x - kn.x; if (dx > S / 2) dx -= S; else if (dx < -S / 2) dx += S; const ex = dx / (ASP * kn.str * 1.3), ey = yy - kn.y; fk = 1 - sstep(1.5, 3.2, Math.sqrt(ex * ex + ey * ey) / kn.ra); }
        let v = 1.04 - (0.3 + 0.12 * stain + 0.14 * fk) * late - 0.08 * st.fine * fine + 0.12 * (streak - 0.5);
        let h = 0.55 + 0.12 * late + 0.04 * fine + 0.05 * streak;               // weathered: the soft early wood wears back
        let cr = 1, cg = 1, cb = 1;                                             // a colour shift (the scorch, the bleach)
        v *= 1 - 0.28 * stain - 0.25 * burn; cr *= 1 + 0.05 * stain; cb *= 1 - 0.16 * stain - 0.2 * burn;
        // scorched along the long edges, in patches: dark, a ragged line, over the outer eighth of the board
        const sc = (1 - sstep(0, 0.13 * SH, e + (scorchN(x, yy) - 0.5) * 8)) * st.scorch * (yy < SH / 2 ? scTop[x] : scBot[x]);
        v *= 1 - 0.55 * sc; cb *= 1 - 0.2 * sc; cg *= 1 - 0.08 * sc;
        // big soft sun-bleached patches: lighter and greyer (toward a pale grey-tan)
        const bl = sstep(0.52, 0.72, bleachN(x, yy)) * st.bleach * (1 - stain) * (1 - sc);
        v *= 1 + 0.16 * bl; cr *= 1 - (st.amber ? 0.02 : 0.05) * bl; cb *= 1 + (st.amber ? 0.04 : 0.16) * bl; cg *= 1 + (st.amber ? 0 : 0.02) * bl;
        // warm amber where the grey has worn off and the wood under it shows, in streaks along the grain
        const am = st.amber ? sstep(0.58, 0.8, amberN(x, yy)) * (1 - bl) * (1 - sc) : 0;
        v *= 1 + 0.1 * am; cr *= 1 + 0.18 * am; cg *= 1 + 0.03 * am; cb *= 1 - 0.16 * am;
        // knots: a dark heart with tight rings of its own, a darker rim (the bark of a dead knot), a resin halo round it
        for (let ki = 0; ki < knots.length; ki++) {
          const kn = knots[ki];
          let dx = x - kn.x; if (dx > S / 2) dx -= S; else if (dx < -S / 2) dx += S;
          const rx = kn.ra * ASP * kn.str; if (dx > rx * 2.4 || dx < -rx * 2.4) continue;
          const ex = dx / (ASP * kn.str), ey = yy - kn.y, de = Math.sqrt(ex * ex + ey * ey) + (hash(x, yy, seed + 15) - 0.5) * 0.15, q = de / kn.ra;
          if (q > 2.4) continue;
          v *= 1 - (kn.feat ? 0.3 : 0.22) * (1 - sstep(1, kn.feat ? 2.4 : 2.2, q));   // the resin halo
          const inK = 1 - sstep(0.9, 1.05 + 0.4 / kn.ra, q);
          if (inK <= 0) continue;
          const kr = Math.pow(Math.sin((q * (2.2 + kn.ra * 0.2) % 1) * Math.PI), 4);
          let kv = (kn.dead ? 0.4 : 0.52) - 0.16 * kr + (kn.dead ? 0 : 0.08 * (1 - sstep(0.15, 0.45, q)));
          kv *= 1 - 0.22 * sstep(0.78, 0.95, q) * (kn.dead ? 1 : 0.5);          // its darker rim (bark round a dead knot)
          let kh = 0.66 - 0.06 * kr;                                            // knots are hard: they stand proud as the wood wears
          if (kn.hole && q < 0.75) { kv = 0.1 + 0.12 * q; kh = 0.1 + 0.3 * q; } // a knot hole
          v = mix(v, kv, inK); h = mix(h, kh, inK);
          cb *= 1 - 0.16 * inK; cr *= 1 + 0.02 * inK; cg *= 1 - 0.04 * inK;
        }
        // the cracks: thin and dark, tapering to nothing at both ends
        for (let ci = 0; ci < checks.length; ci++) {
          const c = checks[ci];
          let dx = x - c.xa; if (dx < 0) dx += S;
          if (dx > c.L) continue;
          const i = c.dir > 0 ? Math.round(dx) : Math.round(c.L - dx), a = i / c.L;
          const w = c.w * Math.pow(Math.sin(Math.PI * Math.min(1, a * 1.15)), 0.7) + 0.05, ad = Math.abs(yy - c.path[Math.min(i, c.path.length - 1)]);
          const k = 1 - sstep(w * 0.5, w + 0.6, ad), lip = (1 - sstep(w + 0.4, w + 1.8, ad)) * (1 - k);   // the crack, a browner lip
          v *= (1 - 0.75 * k) * (1 - 0.12 * lip); h -= 0.35 * k;
        }
        if (rough) {   // saw marks across a rough board, in patches (gentle: finer or stronger, they shimmer)
          const saw = Math.sin((x + Math.sin(yy * 0.15) * 4) * 0.55) * sstep(0.45, 0.7, bleachN(x * 3 % S, yy));
          v *= 0.975 + 0.025 * saw; h += 0.012 * saw;
        }
        // the bevelled edges: the strip's top and bottom rows fall away (dark gap, then a lip), a little uneven
        const eb = e + edgeN[x];
        if (eb < 6) { const k = clamp01(eb / 6); h *= 0.3 + 0.7 * k; v *= eb < 1.2 ? 0.5 : 0.78 + 0.22 * k; }
        let r = base[0] * v * cr, gg = base[1] * v * cg, b = base[2] * v * cb;
        // a nail where the board crosses a stud (u = 0.5 of every repeat), its rust run down the board (toward row 0)
        const nx = x - 256, ny = (yy - 20) * 1.4, nd = Math.sqrt(nx * nx + ny * ny);
        if (nd < 3.4) { const f = nd / 3.4; r = 70 - 30 * f; gg = 64 - 30 * f; b = 60 - 30 * f; h = 0.95 - 0.3 * f * f; }
        else if (nd < 6.5 || (Math.abs(nx) < 2.5 && ny < 0 && ny > -14)) { r *= 0.8; gg *= 0.74; b *= 0.62; }
        put(x, y0 + yy, r, gg, b, h);
      }
    }
  }
  drawShakes(put);
  drawEnds(put);
}

// the shake strips: split cedar or pine, so the grain is straight (streaks running down the slope, noise stretched ten
// times along them), two or three deeper split lines, the silver-brown of shakes that have stood in the weather for years.
// No rings, no knots: a split follows the grain round a knot, so knotty wood never makes a shake.
function drawShakes(put) {
  const S = WOOD.w;
  for (let k = 0; k < 2; k++) {
    const [y0, SH] = WOOD.rows[WOOD.shake + k], seed = 7000 + k * 97, R = rng(seed);
    const splits = [];
    for (let i = 0; i < 3; i++) splits.push({ y: 4 + R() * (SH - 8), w: 0.35 + R() * 0.5, dark: 0.35 + R() * 0.35, a: R() * S, L: 160 + R() * 300 });
    const stre = coarse(S, SH, 2, 1, (u, t) => fbm(u, t, 10, 6, 3, seed));                    // the long streaks
    const blot = coarse(S, SH, 8, 4, (u, t) => fbm(u, t, 4, 2, 3, seed + 3));                 // darker and greyer patches
    const wand = new Float32Array(S); for (let x = 0; x < S; x++) wand[x] = (fbm(x / S, 0.5, 6, 1, 2, seed + 5) - 0.5) * 4;
    for (let yy = 0; yy < SH; yy++) {
      const t = yy / SH;
      for (let x = 0; x < S; x++) {
        const u = x / S, st = stre(x, yy), fine = fbm(u, t, 48, 12, 1, seed + 1);
        let v = 0.94 + 0.3 * (st - 0.5) + 0.12 * (fine - 0.5) + 0.04 * (hash(x, yy, seed + 2) - 0.5);
        let h = 0.55 + 0.12 * (st - 0.5) + 0.04 * (fine - 0.5);
        const bl = blot(x, yy); v *= 1 - 0.18 * sstep(0.55, 0.75, bl);
        for (const sp of splits) {    // a split: a dark line along the grain, part of the way down the shake
          let dx = x - sp.a; if (dx < 0) dx += S;
          if (dx > sp.L) continue;
          const a = dx / sp.L, w = sp.w * Math.pow(Math.sin(Math.PI * a), 0.5) + 0.05, ad = Math.abs(yy - sp.y - wand[x] * 0.5);
          const kk = 1 - sstep(w * 0.5, w + 0.7, ad);
          v *= 1 - sp.dark * kk; h -= 0.3 * kk;
        }
        // the edges: the gap to the next shake
        const e = Math.min(yy, SH - 1 - yy);
        if (e < 2) { v *= e < 0.5 ? 0.55 : 0.8; h *= e < 0.5 ? 0.4 : 0.75; }
        const sv = k ? 0.9 : 1;   // the second strip a shade darker, so the two shakes of a pair differ
        put(x, y0 + yy, 140 * v * sv, 127 * v * sv, 112 * v * sv * (1 + 0.04 * (bl - 0.5)), h);
      }
    }
  }
}

// the end grain. Logs and beams (the four big squares): a round end filling the square, growth rings round a heart near
// its middle, dark heartwood, a paler band of sapwood, a check or two running out from the heart, and outside the
// round, in the corners, dark bark, with the end darkening toward its rim, so a square box end reads as a round log.
// Boards (the eight small squares): rings round a heart inside the square, or off its edge (a board cut from beside the
// heart: the rings are arcs). Faint rays, saw marks, a worn dark lip.
function drawEnds(put) {
  const R = rng(77);
  for (let k = 0; k < WOOD.ends.length; k++) {
    const [ox, oy, sz] = WOOD.ends[k], sc = sz / 128, seed = 950 + k * 13, log = k < WOOD.logEnds;
    // (worked out on a 128 plan, whatever the square's size)
    const inside = log || k < WOOD.logEnds + 3, ang = R() * Math.PI * 2;
    const cx = log ? 64 + (R() - 0.5) * 50 : inside ? 64 + (R() - 0.5) * 50 : 64 + Math.cos(ang) * (95 + R() * 70);
    const cy = log ? 64 + (R() - 0.5) * 50 : inside ? 64 + (R() - 0.5) * 50 : 64 + Math.sin(ang) * (95 + R() * 70);
    const ringW = 3.2 + R() * 2.2, heart = inside ? 24 + R() * 18 : 0, sap = inside ? heart + 14 + R() * 10 : 999;
    const rad = 55 + R() * 3;                                   // a log's round end (on the 128 plan): about 90% of the square
    const cracks = []; const ncr = log ? Math.floor(R() * 4) : inside ? 1 + Math.floor(R() * 1.8) : Math.floor(R() * 1.6);
    for (let c = 0; c < ncr; c++) cracks.push({ a: R() * Math.PI * 2, w: 0.012 + R() * 0.022, from: inside ? 3 + R() * 10 : 0 });
    const sawA = R() * Math.PI, base = log ? [139, 106, 72] : [150, 112, 76], wob = coarse(128, 128, 2, 2, (u, v) => fbm(u, v, 4, 4, 3, seed));
    for (let py = 0; py < sz; py++) for (let px = 0; px < sz; px++) {
      const xx = (px + 0.5) / sc - 0.5, yy = (py + 0.5) / sc - 0.5;
      const dx = xx - cx, dy = yy - cy, d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
      const dw = d + (wob(Math.min(127, xx), Math.min(127, yy)) - 0.5) * 9 + Math.sin(a * 3 + k) * d * 0.03;
      // ring count, the years uneven (some rings wide, some narrow)
      const g0 = dw / ringW, g = g0 + 0.45 * Math.sin(g0 * 0.9 + k) + 0.3 * (vnoise(g0 * 0.6, 0.5, 64, 1, seed + 1) - 0.5);
      const f = g - Math.floor(g), late = sstep(0.6, 0.92, f) * (1 - sstep(0.95, 1, f));
      let v = 0.86 - 0.3 * late;
      let r = base[0], gg = base[1], b = base[2];
      if (inside) {   // heartwood darker and redder, the sapwood paler, a dark pith
        const hw = 1 - sstep(heart - 3, heart + 3, dw);
        v *= 1 - 0.18 * hw; r *= 1 + 0.05 * hw; b *= 1 - 0.1 * hw;
        v *= 1 + 0.1 * sstep(sap - 4, sap + 4, dw);
        v *= 1 - 0.55 * (1 - sstep(1.5, 3.5, d));
      }
      const ray = Math.pow(hash(Math.floor((a + Math.PI) * 60), 0, seed + 2), 6) * 0.08;   // the faint rays
      v *= 1 + ray;
      v *= 1 - 0.07 * (d / 128);
      v *= 0.97 + 0.03 * Math.sin((xx * Math.cos(sawA) + yy * Math.sin(sawA)) * 0.7);       // saw marks
      v *= 0.93 + 0.07 * hash(px, py, seed + 3);
      let h = 0.6 - 0.08 * late;
      for (const c of cracks) {      // a check: a wedge from near the heart, wider the further out it runs
        if (d < c.from) continue;
        const da = angDiff(a, c.a);
        const half = (0.6 + (d - c.from) * c.w) / Math.max(d, 1), kk = 1 - sstep(half * 0.6, half * 1.2 + 0.6 / Math.max(d, 1), da);
        v *= 1 - 0.68 * kk; h -= 0.4 * kk;
      }
      if (log) {
        // the round end (measured from the square's middle, the heart off to one side): darkening toward its rim, a dark
        // line of cambium, then bark out in the corners
        const mx = xx - 64, my = yy - 64, rr = (Math.sqrt(mx * mx + my * my) - (wob(Math.min(127, xx), Math.min(127, yy)) - 0.5) * 7) / rad;
        v *= 1 - 0.35 * Math.pow(clamp01(rr), 3);
        const bark = sstep(0.97, 1.02, rr), cam = (1 - sstep(0.0, 0.035, Math.abs(rr - 0.975))) * (1 - bark);
        v *= 1 - 0.45 * cam; h -= 0.1 * cam;
        if (bark > 0) {
          const bn = fbm(xx / 128, yy / 128, 16, 16, 2, seed + 5), bv = 0.75 + 0.5 * bn;
          r = mix(r * v, 40 * bv, bark); gg = mix(gg * v, 28 * bv, bark); b = mix(b * v, 20 * bv, bark); v = 1; h = mix(h, 0.5 + 0.2 * bn, bark);
        }
      } else {
        const e = Math.min(xx, yy, 127 - xx, 127 - yy) + (hash(px >> 1, py >> 1, seed + 4) - 0.5) * 2;
        if (e < 5) { const kk = clamp01(e / 5); v *= 0.62 + 0.38 * kk; h *= 0.5 + 0.5 * kk; }
      }
      put(ox + px, oy + py, r * v, gg * v, b * v, h);
    }
  }
}

function drawWood(look = 'rustic') {
  const W = WOOD.w, Hh = WOOD.h, col = new Uint8ClampedArray(W * Hh * 4), H = new Float32Array(W * Hh);
  const put = (x, y, r, g, b, h) => { const i = y * W + x; col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b; col[i * 4 + 3] = 255; H[i] = h; };
  if (look === 'straight' || !WOOD_STYLE[look]) { drawStraight(put); drawShakes(put); } else drawBoards(put, look);
  return { col, H };
}

// ── stone: tiling rock (0.7 m to a repeat, each stone its own window on it), five looks ──────────────────────────────
// Every look keeps its features small next to the 0.7 m tile, so the windows on neighbouring stones don't show a repeat.
// nrm: how steep its normal map is; rough: its roughness (river rock is polished by the water)
export const STONE_LOOKS = {
  fieldstone: { label: 'Fieldstone', note: 'mottled grey-brown, the odd patch of lichen, soft lumps', nrm: 5, rough: 0.93 },
  granite: { label: 'Granite', note: 'salt-and-pepper grains', nrm: 3, rough: 0.8 },
  sandstone: { label: 'Sandstone', note: 'warm tan, faint bedding layers, gritty', nrm: 4, rough: 0.96 },
  river: { label: 'River rock', note: 'smooth, soft rounded blotches', nrm: 2.2, rough: 0.72 },
  veined: { label: 'Veined (first look)', note: 'mottled rock with ridged noise lines', nrm: 5, rough: 0.92 },
};
// the first look's average colour (0..1): chinking and mortar use the stone texture too, and are re-tinted against
// this so they stay the same colour whichever rock is chosen
export const STONE_REF = [0.389, 0.363, 0.316];

const STONE_PAINT = {
  // grey-brown, mottled at two sizes, crusts of lichen in clusters (pale grey-green, the odd yellow or black), pits
  fieldstone(x, y, u, v, o) {
    const wu = u + (fbm(u, v, 5, 5, 2, 301) - 0.5) * 0.08, wv = v + (fbm(u, v, 5, 5, 2, 303) - 0.5) * 0.08;
    const big = fbm(wu, wv, 4, 4, 4, 311), mid = fbm(wu, wv, 14, 14, 3, 321), hue = fbm(wu, wv, 3, 3, 3, 331);
    const grit = hash(x, y, 341), sand = vnoise(u * 96, v * 96, 96, 96, 343);
    const br = sstep(0.38, 0.64, hue);
    const l = 0.84 + 0.55 * (big - 0.5) + 0.32 * (mid - 0.5) + 0.12 * (grit - 0.5) + 0.08 * (sand - 0.5);
    let r = (118 + 10 * br) * l, g = (113 + 3 * br) * l, b = (106 - 7 * br) * l;
    const pit = sstep(0.84, 0.92, vnoise(u * 64, v * 64, 64, 64, 345)) * sstep(0.55, 0.65, mid);
    r *= 1 - 0.4 * pit; g *= 1 - 0.4 * pit; b *= 1 - 0.4 * pit;
    let lich = 0;
    const gather = (fbm(u, v, 3, 3, 2, 371) - 0.5) * 1.9;                   // lichen gathers in some parts of a stone
    for (const [n, sd, dens, sz] of [[16, 351, -0.12, 0.42], [40, 361, -0.08, 0.34]]) {
      const here = gather + dens;
      if (here <= 0) continue;
      const C = cells(u + (fbm(u, v, 24, 24, 2, sd + 5) - 0.5) * 0.02, v + (fbm(u, v, 24, 24, 2, sd + 7) - 0.5) * 0.02, n, sd);
      if (C.id > here) continue;
      const rr = sz * (0.4 + 0.6 * ((C.id * 7.31) % 1)), k = 1 - sstep(rr - 0.12, rr + 0.08, C.f1);
      if (k <= 0) continue;
      const kind = (C.id * 13.7) % 1;
      const lc = kind < 0.75 ? [150, 156, 136] : kind < 0.9 ? [166, 146, 100] : [70, 70, 64];
      const fl = 0.86 + 0.24 * grit - 0.12 * sstep(rr * 0.6, rr, C.f1);   // speckled crust, a darker edge
      r = mix(r, lc[0] * fl, k * 0.6); g = mix(g, lc[1] * fl, k * 0.6); b = mix(b, lc[2] * fl, k * 0.6);
      lich = Math.max(lich, k);
    }
    o.r = r; o.g = g; o.b = b; o.h = 0.52 * big + 0.3 * mid + 0.05 * grit + 0.03 * sand + 0.04 * lich - 0.2 * pit;
  },
  // grains a few millimetres across: white and faintly pink feldspar, grey glassy quartz, black mica; split-faced lumps
  granite(x, y, u, v, o) {
    const C = cells(u, v, 72, 401, 1), id = C.id, edge = sstep(0, 0.16, C.f2 - C.f1);
    const big = fbm(u, v, 4, 4, 4, 411), mid = fbm(u, v, 12, 12, 3, 421), tone = fbm(u, v, 3, 3, 2, 431);
    let c;
    if (id < 0.1) c = [48, 46, 46];
    else if (id < 0.38) c = [140 + 30 * ((id * 9.1) % 1), 140 + 30 * ((id * 9.1) % 1), 145 + 30 * ((id * 9.1) % 1)];
    else if (id < 0.8) c = [200, 196, 190];
    else c = [204, 182, 168];
    const sp = cells(u, v, 170, 441), speck = sp.id < 0.07 ? 1 - sstep(0.2, 0.36, sp.f1) : 0;   // fine black specks
    const l = (0.86 + 0.12 * edge) * (0.92 + 0.3 * (big - 0.5) + 0.12 * (tone - 0.5)) * (0.94 + 0.12 * hash(x, y, 451)) * (1 - 0.6 * speck);
    o.r = c[0] * l; o.g = c[1] * l; o.b = c[2] * l;
    o.h = 0.55 * big + 0.25 * mid + (id < 0.1 ? -0.03 : id < 0.38 ? 0.04 : 0) - 0.03 * (1 - edge);
  },
  // tan layers of laid-down sand, each its own shade and hardness (the hard ones stand out), fine laminae, rusty iron
  // stains, grit
  sandstone(x, y, u, v, o) {
    const NB = 5, warp = (fbm(u, v, 2, 2, 3, 501) - 0.5) * 0.45 + (fbm(u, v, 8, 8, 2, 503) - 0.5) * 0.1;
    const b = v * NB + warp, bi = Math.floor(b), bf = b - bi, m = (k) => ((k % NB) + NB) % NB;
    const t0 = hash(m(bi), 0, 511), t1 = hash(m(bi + 1), 0, 511), blend = sstep(0.65, 1, bf), tone = mix(t0, t1, blend);
    const hd = mix(hash(m(bi), 1, 513), hash(m(bi + 1), 1, 513), blend);
    const lam = Math.sin((b * 3 + (fbm(u, v, 6, 6, 2, 515) - 0.5) * 0.8) * Math.PI * 2);
    const big = fbm(u, v, 5, 5, 4, 521), mid = fbm(u, v, 16, 16, 2, 523), grit = hash(x, y, 531), sand = vnoise(u * 128, v * 128, 128, 128, 533);
    const iron = sstep(0.6, 0.85, fbm(u + (fbm(u, v, 6, 6, 2, 543) - 0.5) * 0.1, v, 4, 4, 4, 541));
    const l = (0.84 + 0.13 * (tone - 0.5) + 0.015 * lam + 0.2 * (big - 0.5) + 0.1 * (mid - 0.5)) * (0.86 + 0.18 * grit + 0.08 * sand) * (grit > 0.98 ? 0.58 : 1);
    const warm = (hash(m(bi), 2, 517) - 0.5) * 0.07;
    let r = 186 * l * (1 + warm), g = 158 * l * (1 + warm * 0.4), bb = 122 * l;
    r = mix(r, 170 * l, iron * 0.4); g = mix(g, 118 * l, iron * 0.4); bb = mix(bb, 80 * l, iron * 0.4);
    const groove = 1 - sstep(0, 0.05, Math.min(bf, 1 - bf));
    o.r = r; o.g = g; o.b = bb; o.h = 0.15 * hd + 0.4 * big + 0.18 * mid + 0.1 * grit + 0.05 * sand - 0.05 * groove;
  },
  // worn smooth by water: soft round patches of a lighter or darker shade, almost no fine detail
  river(x, y, u, v, o) {
    const wu = u + (fbm(u, v, 4, 4, 2, 601) - 0.5) * 0.1, wv = v + (fbm(u, v, 4, 4, 2, 603) - 0.5) * 0.1;
    let l = 0.9 + 0.12 * (fbm(u, v, 3, 3, 3, 605) - 0.5), warm = 0;
    for (const [n, sd, amt] of [[5, 611, 0.15], [11, 621, 0.09]]) {
      const B = blobs(wu, wv, n, sd); l += amt * B.s; warm += 0.08 * B.w;
    }
    const fleck = cells(u, v, 60, 631), lf = fleck.id < 0.03 ? 1 - sstep(0.15, 0.3, fleck.f1) : 0;
    l *= 1 + 0.25 * lf; l *= 0.985 + 0.03 * hash(x, y, 641);
    o.r = 124 * l * (1 + warm); o.g = 126 * l; o.b = 128 * l * (1 - warm);
    o.h = 0.7 * fbm(u, v, 3, 3, 3, 651) + 0.15 * fbm(u, v, 8, 8, 2, 653);
  },
  // the first look: mottled grey-brown rock with pits and ridged noise "veins"
  veined(x, y, u, v, o) {
    const big = fbm(u, v, 4, 4, 4, 51), mid = fbm(u, v, 16, 16, 3, 61), fine = hash(x, y, 71);
    const vein = Math.pow(1 - Math.abs(fbm(u, v, 6, 6, 3, 81) - 0.5) * 2, 24);
    const warm = fbm(u, v, 3, 3, 2, 91);
    const l = 0.55 + 0.25 * big + 0.12 * mid + 0.1 * (fine - 0.5) - 0.18 * vein;
    o.r = 255 * l * (0.5 + 0.08 * warm); o.g = 255 * l * (0.49 + 0.03 * warm); o.b = 255 * l * (0.46 - 0.04 * warm);
    o.h = 0.5 * big + 0.3 * mid + 0.08 * fine - 0.25 * vein;
  },
};
function drawStone(look = 'fieldstone') {
  const S = 256, col = new Uint8ClampedArray(S * S * 4), H = new Float32Array(S * S), paint = STONE_PAINT[look] || STONE_PAINT.fieldstone;
  const o = { r: 0, g: 0, b: 0, h: 0 }, mean = [0, 0, 0];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x; paint(x, y, x / S, y / S, o);
    col[i * 4] = o.r; col[i * 4 + 1] = o.g; col[i * 4 + 2] = o.b; col[i * 4 + 3] = 255; H[i] = o.h;
    mean[0] += col[i * 4]; mean[1] += col[i * 4 + 1]; mean[2] += col[i * 4 + 2];
  }
  return { col, H, mean: mean.map((m) => m / (S * S * 255)) };
}

// ── ground: short grass over soil (tiles both ways) ───────────────────────────────────────────────────────────────────
function drawGround() {
  const S = 256, c = canvasOf(S, S), g = c.getContext('2d'), R = rng(5), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4, n = fbm(u, v, 4, 4, 4, 11), m = fbm(u, v, 16, 16, 2, 13);
    img.data[i] = 62 + 40 * n + 14 * m; img.data[i + 1] = 78 + 36 * n + 12 * m; img.data[i + 2] = 34 + 16 * n; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // blades: short strokes, drawn three times over the seams so the tile wraps
  for (let k = 0; k < 2600; k++) {
    const x = R() * S, y = R() * S, len = 3 + R() * 6, a = -Math.PI / 2 + (R() - 0.5) * 1.1, l = R();
    g.strokeStyle = `rgb(${70 + 70 * l | 0},${90 + 70 * l | 0},${30 + 30 * l | 0})`; g.lineWidth = 0.8 + R() * 0.7;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke(); }
  }
  return c;
}

// ── the weathering noise, one kind per channel (all tile) ────────────────────────────────────────────────────────────
//  R: big soft patches (where moss and grime gather)   G: medium blotches   B: fine grit
//  A: moss clumps: lots of little rounded cushions packed together, the "height" of the moss
function drawNoise() {
  const S = 256, px = new Uint8Array(S * S * 4), A = new Float32Array(S * S), R = rng(3);
  for (let k = 0; k < 2600; k++) {   // the cushions: domes of random size, the highest wins where they overlap
    const cx = R() * S, cy = R() * S, r = 2 + R() * R() * 7, hgt = 0.55 + R() * 0.45, r2 = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 > r2) continue;
      const i = ((y + S) % S) * S + ((x + S) % S), v = hgt * Math.sqrt(1 - d2 / r2);
      if (v > A[i]) A[i] = v;
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    px[i] = 255 * fbm(u, v, 4, 4, 4, 21); px[i + 1] = 255 * fbm(u, v, 8, 8, 4, 31); px[i + 2] = 255 * fbm(u, v, 32, 32, 3, 41);
    px[i + 3] = 255 * clamp01(A[y * S + x] * 0.85 + 0.15 * hash(x, y, 9));
  }
  return px;
}

// ── decal stamps ──────────────────────────────────────────────────────────────────────────────────────────────────────
function roughEdges(g, w, h, amount, seed) {   // eat into the paint/paper with noise so a stamp isn't a clean rectangle
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, n = fbm(x / w, y / h, 8, 8 * h / w | 1, 3, seed), f = hash(x, y, seed);
    if (n * 0.8 + f * 0.2 < amount) d[i + 3] = 0; else d[i + 3] *= clamp01((n - amount) * 8 + 0.4);
  }
  g.putImageData(img, 0, 0);
}
function drawDecals() {
  const out = {};
  { // a sign painted straight onto the boards (white lead paint, worn thin)
    const c = canvasOf(512, 128), g = c.getContext('2d');
    g.fillStyle = '#efe6cf'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '64px Rye, Georgia, serif'; g.fillText('ASSAY OFFICE', 256, 60);
    g.fillRect(40, 104, 432, 5);
    roughEdges(g, 512, 128, 0.3, 3); out.sign = { canvas: c, w: 2.0, h: 0.5, label: 'Painted sign' };
  }
  { // a horseshoe, iron gone rusty, nailed up for luck (open end up)
    const c = canvasOf(128, 128), g = c.getContext('2d');
    g.lineCap = 'butt'; g.lineWidth = 18; g.strokeStyle = '#4a3a30';
    g.beginPath(); g.arc(64, 54, 38, Math.PI * 0.08, Math.PI * 0.92); g.lineTo(26, 18); g.moveTo(64 + 38 * Math.cos(Math.PI * 0.08), 54 + 38 * Math.sin(Math.PI * 0.08)); g.lineTo(102, 18); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#8a5a34'; g.beginPath(); g.arc(64, 54, 38, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    g.fillStyle = '#1e1612'; for (const a of [0.2, 0.36, 0.5, 0.64, 0.8]) { g.beginPath(); g.arc(64 + 38 * Math.cos(Math.PI * a), 54 + 38 * Math.sin(Math.PI * a), 2.6, 0, 7); g.fill(); }
    const img = g.getImageData(0, 0, 128, 128), d = img.data;   // rust speckle
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { const n = hash(i, 1, 4); if (n > 0.7) { d[i] = 150; d[i + 1] = 80; d[i + 2] = 40; } }
    g.putImageData(img, 0, 0);
    out.horseshoe = { canvas: c, w: 0.28, h: 0.28, label: 'Horseshoe' };
  }
  { // a dark water stain, darker at its tide-line
    const c = canvasOf(128, 128), g = c.getContext('2d'), img = g.createImageData(128, 128), d = img.data;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const dx = (x - 64) / 60, dy = (y - 60) / 62, r = Math.hypot(dx, dy * 0.9) + (fbm(x / 128, y / 128, 4, 4, 3, 77) - 0.5) * 0.5;
      const i = (y * 128 + x) * 4, inside = clamp01((1 - r) * 6), rim = Math.exp(-((r - 0.9) ** 2) / 0.004);
      d[i] = 34; d[i + 1] = 28; d[i + 2] = 22; d[i + 3] = 255 * clamp01(inside * 0.4 + rim * 0.5) * (0.8 + 0.2 * hash(x, y, 2));
    }
    g.putImageData(img, 0, 0); out.stain = { canvas: c, w: 0.9, h: 0.9, label: 'Stain' };
  }
  { // a WANTED poster, sun-yellowed paper, torn corners
    const c = canvasOf(128, 256), g = c.getContext('2d'); g.scale(1, 4 / 3);   // drawn on a 128 x 192 plan, stretched to 256 rows (a power of two, so WebGL1 can mipmap it)
    g.fillStyle = '#d9c79a'; g.fillRect(6, 6, 116, 180);
    g.fillStyle = '#3a2a1c'; g.textAlign = 'center'; g.font = '24px Rye, Georgia, serif'; g.fillText('WANTED', 64, 36);
    g.font = '11px Rye, Georgia, serif'; g.fillText('DEAD OR ALIVE', 64, 52);
    g.fillStyle = '#6e5a40'; g.fillRect(30, 60, 68, 70);
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(64, 88, 17, 0, 7); g.fill(); g.fillRect(40, 110, 48, 22);   // a face in silhouette
    g.fillRect(36, 74, 56, 6); g.fillRect(48, 62, 32, 14);                                                     // his hat
    g.font = '22px Rye, Georgia, serif'; g.fillText('$500', 64, 160); g.font = '9px Georgia, serif'; g.fillText('REWARD', 64, 176);
    g.setTransform(1, 0, 0, 1, 0, 0); const img = g.getImageData(0, 0, 128, 256), d = img.data;   // stains on the paper, torn corners
    for (let Y = 0; Y < 256; Y++) for (let x = 0; x < 128; x++) {
      const y = Y * 0.75, i = (Y * 128 + x) * 4, n = fbm(x / 128, Y / 256, 4, 6, 3, 55);
      d[i] *= 0.8 + 0.3 * n; d[i + 1] *= 0.8 + 0.28 * n; d[i + 2] *= 0.75 + 0.25 * n;
      const corner = Math.min(Math.hypot(x - 6, y - 6), Math.hypot(x - 122, y - 186), Math.hypot(x - 122, y - 6));
      if (corner < 14 + 10 * hash(x >> 2, y >> 2, 6)) d[i + 3] = 0;
    }
    g.putImageData(img, 0, 0); out.poster = { canvas: c, w: 0.42, h: 0.63, label: 'Poster' };
  }
  for (const k in out) { const D = out[k]; D.tex = tex(D.canvas, { repeat: false }); }
  return out;
}

// ── all of them, with what each costs ────────────────────────────────────────────────────────────────────────────────
export const gpuBytes = (w, h, mips = true) => w * h * 4 * (mips ? 4 / 3 : 1);

// the stone and the wood are each one look (one of STONE_LOOKS, WOOD_LOOKS) and can be painted again in place
// (setStone, setWood): the same canvases and textures, so every material using them just picks up the new picture
export const DEFAULT_STONE = 'fieldstone', DEFAULT_WOOD = 'rustic';
function paintInto(canvas, px) { const g = canvas.getContext('2d'), img = g.createImageData(canvas.width, canvas.height); img.data.set(px); g.putImageData(img, 0, 0); }
function woodPixels(look) {
  const t0 = performance.now(), W = drawWood(look);
  return { col: W.col, nrm: normalsFrom(W.H, WOOD.w, WOOD.h, 6, false), ms: performance.now() - t0 };
}
function stonePixels(look) {
  const t0 = performance.now(), S = drawStone(look);
  return { col: S.col, nrm: normalsFrom(S.H, 256, 256, STONE_LOOKS[look].nrm, true), mean: S.mean, ms: performance.now() - t0 };
}
// paint a new look onto the textures T already has; returns how long it took (ms), drawing and upload together
export function setWood(T, look) {
  if (!WOOD_LOOKS[look]) look = DEFAULT_WOOD;
  const t0 = performance.now(), P = woodPixels(look);
  paintInto(T.wood.image, P.col); paintInto(T.woodN.image, P.nrm);
  T.wood.needsUpdate = T.woodN.needsUpdate = true;
  T.woodLook = look; T.msWood = performance.now() - t0;
  T.list[0].note = WOOD_LOOKS[look].label + ': 12 board strips, 2 shake strips, 12 end-grain squares';
  return T.msWood;
}
export function setStone(T, look) {
  if (!STONE_LOOKS[look]) look = DEFAULT_STONE;
  const t0 = performance.now(), P = stonePixels(look);
  paintInto(T.stone.image, P.col); paintInto(T.stoneN.image, P.nrm);
  T.stone.needsUpdate = T.stoneN.needsUpdate = true;
  T.stoneLook = look; T.stoneMean = P.mean; T.msStone = performance.now() - t0;
  T.list[2].note = STONE_LOOKS[look].label + ': tiling rock';
  return T.msStone;
}

export async function makeTextures(o = {}) {
  try { await Promise.all([document.fonts.load('64px Rye'), document.fonts.load('15px Bitter')]); } catch (e) { /* fonts are optional */ }
  const t0 = performance.now();
  const N = drawNoise();
  // (the wood is seen at a slant on every wall and roof: more anisotropic filtering, or its fine grain shimmers)
  const wood = tex(canvasOf(WOOD.w, WOOD.h), { repeat: true, repeatT: false, aniso: 8 });
  const woodN = tex(canvasOf(WOOD.w, WOOD.h), { srgb: false, repeat: true, repeatT: false, aniso: 8 });
  const stone = tex(canvasOf(256, 256)), stoneN = tex(canvasOf(256, 256), { srgb: false });
  const ground = tex(drawGround());
  // the noise is raw numbers (four channels, alpha too), so it goes up as data, not through a canvas (a canvas would
  // spoil the colour of see-through pixels)
  const noise = new THREE.DataTexture(N, 256, 256, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = THREE.LinearFilter; noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true; noise.needsUpdate = true;
  const noiseCanvas = canvasOf(256, 256, (() => { const p = new Uint8ClampedArray(N.length); for (let i = 0; i < N.length; i += 4) { p[i] = N[i]; p[i + 1] = N[i + 1]; p[i + 2] = N[i + 3]; p[i + 3] = 255; } return p; })());
  const decals = drawDecals();
  const list = [
    { name: 'Wood trim sheet', note: '', canvas: wood.image, tex: wood },
    { name: 'Wood normals', note: 'bevels, grain, knots, nail heads', canvas: woodN.image, tex: woodN },
    { name: 'Stone', note: '', canvas: stone.image, tex: stone },
    { name: 'Stone normals', note: '', canvas: stoneN.image, tex: stoneN },
    { name: 'Grass', note: 'tiling ground', canvas: ground.image, tex: ground },
    { name: 'Weathering noise', note: 'R patches, G blotches, A moss clumps (shown as blue)', canvas: noiseCanvas, tex: noise },
    ...Object.values(decals).map((D) => ({ name: 'Decal: ' + D.label, note: '', canvas: D.canvas, tex: D.tex })),
  ];
  for (const L of list) { L.w = L.canvas.width; L.h = L.canvas.height; L.bytes = gpuBytes(L.w, L.h); }
  const T = { wood, woodN, stone, stoneN, ground, noise, decals, list, totalBytes: list.reduce((s, L) => s + L.bytes, 0) };
  setWood(T, o.wood || DEFAULT_WOOD); setStone(T, o.stone || DEFAULT_STONE);
  T.ms = performance.now() - t0;
  return T;
}
