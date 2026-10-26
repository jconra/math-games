// THE LAB'S TEXTURES, DRAWN IN CODE AT LOAD (nothing is downloaded): small canvases turned into three.js textures.
//
//  wood     512 x 512  a TRIM SHEET: 12 board strips (32 px tall each, the full width, so they tile along their length)
//                      with grain, knots, a nail every repeat and a bevelled edge, then 4 end-grain squares at the bottom.
//                      Every board, post, rail and shingle in the cabin points its UVs at one strip of this one picture.
//  woodN    512 x 512  its normal map (the bevels, grain grooves, nail heads, end-grain rings), worked out from a height map
//  stone    256 x 256  tiling rock, and stoneN its normal map
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
function tex(canvas, { srgb = true, repeat = true, repeatT = repeat } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

// ── the wood trim sheet ───────────────────────────────────────────────────────────────────────────────────────────────
export const WOOD = { size: 512, strip: 32, strips: 12, endRow: 384, endTile: 128, repeatM: 1.2 };
// strip colours: weathered pine and fir, a couple greyed by the sun, two rough-sawn (strips 10, 11)
const STRIP_COL = [[166, 136, 104], [150, 122, 94], [176, 144, 108], [142, 120, 98], [160, 136, 110], [136, 112, 88],
  [170, 138, 102], [150, 132, 114], [158, 126, 96], [144, 126, 110], [148, 120, 92], [138, 114, 90]];

function drawWood() {
  const S = WOOD.size, col = new Uint8ClampedArray(S * S * 4), H = new Float32Array(S * S), R = rng(7);
  const put = (x, y, r, g, b, h) => { const i = y * S + x; col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b; col[i * 4 + 3] = 255; H[i] = h; };
  for (let s = 0; s < WOOD.strips; s++) {
    const y0 = s * WOOD.strip, base = STRIP_COL[s], rough = s >= 10, seed = 100 + s * 31;
    const lines = 5 + R() * 5, warpAmt = 0.5 + R() * 0.9;
    const knots = []; const nk = Math.floor(R() * 2.4);
    for (let k = 0; k < nk; k++) knots.push({ x: 40 + R() * 160 + (k ? 256 : 0), y: 7 + R() * 18, r: 2.5 + R() * 3.5 });
    for (let yy = 0; yy < WOOD.strip; yy++) {
      const t = yy / WOOD.strip;
      for (let x = 0; x < S; x++) {
        const u = x / S;
        // the grain: lines running along the board, wavy (the warp), wrapping so the strip tiles along its length
        let warp = fbm(u, t * 0.3, 3, 1, 3, seed) * warpAmt + fbm(u, t, 9, 2, 2, seed + 5) * 0.15;
        let dk = 0;
        for (const k of knots) {   // a knot pushes the grain round it and is dark at its heart
          let dx = x - k.x; if (dx > S / 2) dx -= S; if (dx < -S / 2) dx += S;
          const d = Math.hypot(dx / 2.2, yy - k.y); warp += Math.max(0, 1 - d / (k.r * 4)) * 0.6 * Math.sign(yy - k.y || 1);
          dk = Math.max(dk, clamp01(1.4 - d / k.r));
        }
        const g = t * lines + warp, ring = g - Math.floor(g), late = Math.pow(Math.sin(ring * Math.PI), 6);   // the dark late-wood lines
        const streak = fbm(u, t, 48, 4, 2, seed + 9);                 // fine streaks along the board
        let v = 0.86 + 0.14 * streak - 0.17 * late - 0.5 * dk * dk;
        if (rough) v *= 0.93 + 0.07 * Math.sin((x + Math.sin(yy * 0.4) * 3) * 0.9);   // saw marks across a rough board
        let h = 0.6 - 0.18 * late + 0.06 * streak - 0.25 * dk;
        // the bevelled edges: the strip's top and bottom rows fall away (dark gap below, a lit lip above)
        const e = Math.min(yy, WOOD.strip - 1 - yy);
        if (e < 3) { const f = e / 3; h *= 0.3 + 0.7 * f; v *= e === 0 ? 0.55 : 0.8 + 0.2 * f; }
        let r = base[0] * v, gg = base[1] * v, b = base[2] * v;
        // a nail where the board crosses a stud (u = 0.5 of every repeat), its rust run down the board
        const nx = x - 256, ny = yy - 22, nd = Math.hypot(nx, ny);
        if (nd < 3.2) { const f = nd / 3.2; r = 70 - 30 * f; gg = 66 - 30 * f; b = 62 - 30 * f; h = 0.95 - 0.3 * f * f; }
        else if (nd < 6 || (Math.abs(nx) < 2.5 && ny > 0 && ny < 9)) { const f = 0.75; r *= f + 0.06; gg *= f; b *= f * 0.85; }
        put(x, y0 + yy, r, gg, b, h);
      }
    }
  }
  // the end grain: rings round an off-centre heart, a radial crack or two
  for (let k = 0; k < 4; k++) {
    const cx = 64 + (R() - 0.5) * 70, cy = 64 + (R() - 0.5) * 70, ringW = 3.5 + R() * 2.5, seed = 900 + k;
    const cracks = [R() * Math.PI * 2, R() * Math.PI * 2];
    for (let yy = 0; yy < 128; yy++) for (let xx = 0; xx < 128; xx++) {
      const dx = xx - cx, dy = yy - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const g = (d + fbm(xx / 128, yy / 128, 4, 4, 2, seed) * 6) / ringW, ring = Math.pow(Math.sin((g - Math.floor(g)) * Math.PI), 8);
      let crack = 0; for (const c of cracks) { let da = Math.abs(a - c); da = Math.min(da, Math.PI * 2 - da); if (d > 8 && da * d < 1.3) crack = 1; }
      const v = (0.78 - 0.16 * ring - 0.1 * (d / 90)) * (1 - 0.55 * crack);
      const e = Math.min(xx, yy, 127 - xx, 127 - yy), lip = e < 3 ? 0.75 + 0.08 * e : 1;
      put(k * 128 + xx, WOOD.endRow + yy, 150 * v * lip, 112 * v * lip, 76 * v * lip, 0.6 - 0.1 * ring - 0.4 * crack);
    }
  }
  return { col, H };
}

// ── stone: mottled grey-brown rock with pits and veins (tiles both ways) ──────────────────────────────────────────────
function drawStone() {
  const S = 256, col = new Uint8ClampedArray(S * S * 4), H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = y * S + x;
    const big = fbm(u, v, 4, 4, 4, 51), mid = fbm(u, v, 16, 16, 3, 61), fine = hash(x, y, 71);
    const vein = Math.pow(1 - Math.abs(fbm(u, v, 6, 6, 3, 81) - 0.5) * 2, 24);
    const warm = fbm(u, v, 3, 3, 2, 91);
    const l = 0.55 + 0.25 * big + 0.12 * mid + 0.1 * (fine - 0.5) - 0.18 * vein;
    col[i * 4] = 255 * l * (0.5 + 0.08 * warm); col[i * 4 + 1] = 255 * l * (0.49 + 0.03 * warm); col[i * 4 + 2] = 255 * l * (0.46 - 0.04 * warm); col[i * 4 + 3] = 255;
    H[i] = 0.5 * big + 0.3 * mid + 0.08 * fine - 0.25 * vein;
  }
  return { col, H };
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

export async function makeTextures() {
  try { await Promise.all([document.fonts.load('64px Rye'), document.fonts.load('15px Bitter')]); } catch (e) { /* fonts are optional */ }
  const t0 = performance.now();
  const W = drawWood(), S = drawStone(), N = drawNoise();
  const wood = tex(canvasOf(512, 512, W.col), { repeat: true, repeatT: false });
  const woodN = tex(canvasOf(512, 512, normalsFrom(W.H, 512, 512, 6, false)), { srgb: false, repeat: true, repeatT: false });
  const stone = tex(canvasOf(256, 256, S.col)), stoneN = tex(canvasOf(256, 256, normalsFrom(S.H, 256, 256, 5, true)), { srgb: false });
  const ground = tex(drawGround());
  // the noise is raw numbers (four channels, alpha too), so it goes up as data, not through a canvas (a canvas would
  // spoil the colour of see-through pixels)
  const noise = new THREE.DataTexture(N, 256, 256, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = THREE.LinearFilter; noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true; noise.needsUpdate = true;
  const noiseCanvas = canvasOf(256, 256, (() => { const p = new Uint8ClampedArray(N.length); for (let i = 0; i < N.length; i += 4) { p[i] = N[i]; p[i + 1] = N[i + 1]; p[i + 2] = N[i + 3]; p[i + 3] = 255; } return p; })());
  const decals = drawDecals();
  const list = [
    { name: 'Wood trim sheet', note: '12 board strips + 4 end-grain squares', canvas: wood.image, tex: wood },
    { name: 'Wood normals', note: 'bevels, grain, nail heads', canvas: woodN.image, tex: woodN },
    { name: 'Stone', note: 'tiling rock', canvas: stone.image, tex: stone },
    { name: 'Stone normals', note: '', canvas: stoneN.image, tex: stoneN },
    { name: 'Grass', note: 'tiling ground', canvas: ground.image, tex: ground },
    { name: 'Weathering noise', note: 'R patches, G blotches, A moss clumps (shown as blue)', canvas: noiseCanvas, tex: noise },
    ...Object.values(decals).map((D) => ({ name: 'Decal: ' + D.label, note: '', canvas: D.canvas, tex: D.tex })),
  ];
  for (const L of list) { L.w = L.canvas.width; L.h = L.canvas.height; L.bytes = gpuBytes(L.w, L.h); }
  return { wood, woodN, stone, stoneN, ground, noise, decals, list, ms: performance.now() - t0, totalBytes: list.reduce((s, L) => s + L.bytes, 0) };
}
