// THE STONE LAB'S ROCK TEXTURE, drawn in code at load: 256 x 256, tiling, 0.7 m to a repeat (each stone reads its own
// window of it). A plain warm grey (each stone's own colour comes from its tint), with:
//   blotches     one soft patch of a lighter or darker tone every 15 to 25 cm (12 to 15% lighter or darker)
//   rust         now and then an ochre-rust stain
//   strata       2 to 4 faint streaks along each stone's long way (the texture's u runs along the wall)
//   grit         fine speckle
//   pits         none on most of a stone, a few on others: small, and only a little darker
//   lichen       a few clusters, 2 to 8 cm across, each a huddle of little pale grey-green crusts (now and then a yellow
//                one), not dots spread evenly
// and its normal map (from a height worked out alongside the colour).

import * as THREE from 'three';

// ── small helpers: a hash, tiling value noise, fractal noise, cells ───────────────────────────────────────────────────
function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
const wrapI = (v, p) => ((v % p) + p) % p;
function vnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
  const a = hash(wrapI(x0, px), wrapI(y0, py), seed), b = hash(wrapI(x0 + 1, px), wrapI(y0, py), seed);
  const c = hash(wrapI(x0, px), wrapI(y0 + 1, py), seed), d = hash(wrapI(x0 + 1, px), wrapI(y0 + 1, py), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(u, v, px, py, oct, seed) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(u * px, v * py, px, py, seed + o * 17); tot += amp; amp *= 0.5; px *= 2; py *= 2; }
  return s / tot;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the nearest of one jittered point per cell of an n x n grid that wraps: its distance (in cells) and a number of its own
function cell(u, v, n, seed) {
  const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, id = 0, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = wrapI(cx, n), wy = wrapI(cy, n);
    const d = Math.hypot(x - cx - hash(wx, wy, seed), y - cy - hash(wx, wy, seed + 1));
    if (d < f1) { f2 = f1; f1 = d; id = hash(wx, wy, seed + 2); } else if (d < f2) f2 = d;
  }
  return [f1, id, f2];
}

export function makeRubbleTexture() {
  const t0 = performance.now(), S = 256, col = new Uint8ClampedArray(S * S * 4), H = new Float32Array(S * S), mean = [0, 0, 0];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = y * S + x;
    // blotches: four cells across the tile (about 18 cm each), each its own tone, soft at the edges
    const wu = u + (fbm(u, v, 4, 4, 2, 11) - 0.5) * 0.12, wv = v + (fbm(u, v, 4, 4, 2, 13) - 0.5) * 0.12;
    const [bf1, bid, bf2] = cell(wu, wv, 4, 21), edge = sstep(0, 0.35, bf2 - bf1);
    const tone = (bid - 0.5) * 0.16 * edge + (fbm(u, v, 3, 3, 3, 31) - 0.5) * 0.12;
    // strata: a few faint streaks running along u (two to four across a stone), wavering, only here and there
    const sw = v * 9 + (fbm(u, v, 2, 3, 3, 41) - 0.5) * 1.6, st = Math.pow(Math.abs(Math.sin(sw * Math.PI)), 10) * sstep(0.5, 0.75, fbm(u, v, 3, 2, 2, 43));
    // grit and a little mid-size mottling
    const grit = hash(x, y, 51) - 0.5, mid = fbm(u, v, 16, 16, 2, 53) - 0.5, fine = fbm(u, v, 48, 48, 2, 57) - 0.5;
    // pits: small, few, soft, and only where a slow noise lets them (so most stones have none)
    const [pf, pid] = cell(u, v, 22, 61), pit = pid < 0.05 ? (1 - sstep(0.04, 0.16, pf)) * sstep(0.55, 0.65, fbm(u, v, 2, 2, 2, 63)) : 0;
    // rust: an ochre stain here and there, soft-edged
    const rust = sstep(0.62, 0.78, fbm(u + 0.3, v, 3, 3, 3, 67)) * sstep(0.45, 0.6, fbm(u, v, 2, 2, 2, 69));
    // lichen: a few clusters, each a huddle of small crusts
    const [cf, cid] = cell(u, v, 3, 71), cr = 0.15 + 0.3 * ((cid * 7.3) % 1), inCl = cid < 0.35 ? 1 - sstep(cr * 0.4, cr, cf) : 0;
    let lich = 0, lc = [150, 158, 140];
    if (inCl > 0) {
      // a crust: ragged-edged patches (noise over a threshold), thicker toward the cluster's middle
      lich = sstep(0.56, 0.63, fbm(u, v, 20, 20, 3, 81) * 0.85 + inCl * 0.15) * inCl;
      if (((cid * 13.1) % 1) < 0.15) lc = [168, 150, 104];
    }
    let l = 0.86 + tone - 0.025 * st + 0.05 * grit + 0.11 * mid + 0.07 * fine;
    l *= 1 - 0.35 * pit;
    let r = 150 * l, g = 146 * l, b = 139 * l;
    r *= 1 + 0.08 * rust; g *= 1 - 0.02 * rust; b *= 1 - 0.16 * rust;
    const k = lich * 0.45; r += (lc[0] * (0.92 + 0.15 * grit) - r) * k; g += (lc[1] * (0.92 + 0.15 * grit) - g) * k; b += (lc[2] * (0.92 + 0.15 * grit) - b) * k;
    col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b; col[i * 4 + 3] = 255;
    mean[0] += col[i * 4]; mean[1] += col[i * 4 + 1]; mean[2] += col[i * 4 + 2];
    H[i] = 0.45 * (fbm(u, v, 3, 3, 4, 91)) + 0.25 * tone + 0.015 * st + 0.05 * grit + 0.16 * mid + 0.08 * fine - 0.05 * pit + 0.04 * lich;
  }
  // its normal map: the slope of the height, wrapping round the edges
  const nrm = new Uint8ClampedArray(S * S * 4), at = (x, y) => H[wrapI(y, S) * S + wrapI(x, S)], k = 7;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    let nx = -dx, ny = dy, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const i = (y * S + x) * 4; nrm[i] = (nx * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * 0.5 + 0.5) * 255; nrm[i + 2] = (nz * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const canvasOf = (px) => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S); img.data.set(px); g.putImageData(img, 0, 0); return c; };
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: tex(canvasOf(col), true), normalMap: tex(canvasOf(nrm), false), mean: mean.map((m) => m / (S * S * 255)), ms: performance.now() - t0 };
}
