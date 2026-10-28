// THE BUILDING LAB'S OWN PICTURES, DRAWN IN CODE AT LOAD (the wood and stone come from the Material Lab and the Stone Lab):
//
//  boards   1024 x 512  one picture for every painted board a building hangs out: the big sign along its top
//                       ("LIVERY & FEED": three cream-painted planks, chunky dark letters, worn a little),
//                       and under it eight small slots, each a stall's chalkboard ("CHESTNUT 120") or, once that horse is
//                       yours, a brass name plate ("COPPER"). A slot is drawn again in place when it changes.
//  floor    256 x 256   the barn's floor: packed dirt with straw trodden into it (tiles both ways)
//  spill    256 x 256   loose straw blown out of the doorway, on see-through (one patch, not tiling)
//  hay      256 x 256   a bale's face: straw packed tight, mostly lying one way (tiles both ways)
//
// Memory on the graphics card: width x height x 4 bytes, plus a third for the smaller copies used far away.

import * as THREE from 'three';

// ── small helpers: a seeded random, tiling value noise ───────────────────────────────────────────────────────────────
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0), m = (v, p) => ((v % p) + p) % p;
  const a = hash(m(x0, px), m(y0, py), seed), b = hash(m(x0 + 1, px), m(y0, py), seed), c = hash(m(x0, px), m(y0 + 1, py), seed), d = hash(m(x0 + 1, px), m(y0 + 1, py), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(u, v, px, py, oct, seed) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(u * px, v * py, px, py, seed + o * 17); tot += amp; amp *= 0.5; px *= 2; py *= 2; }
  return s / tot;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(canvas, { repeat = true, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  return t;
}
export const gpuBytes = (w, h) => w * h * 4 * 4 / 3;

// a straw: a thin bent stroke, lighter along its middle, drawn again across the edges when the picture tiles
function straw(g, x, y, len, ang, w, col, S, wrap) {
  const bend = (Math.sin(x * 12.9 + y * 7.1) * 0.5) * 0.25;
  const pts = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4, a = ang + bend * (t - 0.5); pts.push([x + Math.cos(a) * len * t, y + Math.sin(a) * len * t]); }
  const offs = wrap ? [-S, 0, S] : [0];
  for (const ox of offs) for (const oy of offs) {
    g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + ox, pts[i][1] + oy);
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
}
// a straw colour: pale gold through tan, a few grey-brown (old, trodden)
function strawCol(R, l = 1, a = 1) {
  const k = R();
  const c = k < 0.55 ? [214, 182, 110] : k < 0.85 ? [188, 152, 88] : [140, 118, 84];
  const s = (0.75 + 0.4 * R()) * l;
  return `rgba(${Math.min(255, c[0] * s) | 0},${Math.min(255, c[1] * s) | 0},${Math.min(255, c[2] * s) | 0},${a})`;
}

// ── the barn floor: packed dirt, straw trodden in ────────────────────────────────────────────────────────────────────
function drawFloor() {
  const S = 256, c = canvasOf(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), R = rng(41);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    const n = fbm(u, v, 4, 4, 4, 401), m = fbm(u, v, 16, 16, 3, 411), grit = hash(x, y, 421);
    const l = 0.78 + 0.35 * (n - 0.5) + 0.2 * (m - 0.5) + 0.1 * (grit - 0.5);
    const warm = fbm(u, v, 3, 3, 2, 431) - 0.5;
    img.data[i] = 112 * l * (1 + 0.12 * warm); img.data[i + 1] = 88 * l; img.data[i + 2] = 62 * l * (1 - 0.1 * warm); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // dark trodden patches and a few pebbles
  for (let k = 0; k < 60; k++) { const x = R() * S, y = R() * S, r = 1 + R() * 2.2; g.fillStyle = `rgba(${60 + R() * 40 | 0},${52 + R() * 30 | 0},${44 + R() * 20 | 0},0.8)`; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.7, R() * 3, 0, 7); g.fill(); } }
  // straw: dull, flattened bits, then fresher ones on top
  for (let k = 0; k < 520; k++) straw(g, R() * S, R() * S, 6 + R() * 18, R() * Math.PI * 2, 0.8 + R() * 1.1, strawCol(R, 0.7, 0.75), S, true);
  for (let k = 0; k < 260; k++) straw(g, R() * S, R() * S, 8 + R() * 22, R() * Math.PI * 2, 1 + R() * 1.2, strawCol(R, 1, 0.95), S, true);
  return c;
}
// loose straw on see-through, thickest in the middle of the patch, thinning out to nothing at its edge
function drawSpill() {
  const S = 256, c = canvasOf(S, S), g = c.getContext('2d'), R = rng(57);
  for (let k = 0; k < 900; k++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.48 * S * (0.7 + 0.3 * R());
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r * 0.9;
    const keep = 1 - r / (0.5 * S); if (R() > keep * 1.3) continue;
    straw(g, x, y, 7 + R() * 20, R() * Math.PI * 2, 1 + R() * 1.3, strawCol(R, 0.95, 1), S, false);
  }
  return c;
}
// a bale's face: dense straw, mostly lying along the bale (u), darker in the gaps between
function drawHay() {
  const S = 256, c = canvasOf(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), R = rng(63);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, n = fbm(x / S, y / S, 3, 12, 3, 601), l = 0.5 + 0.3 * n;
    img.data[i] = 150 * l; img.data[i + 1] = 118 * l; img.data[i + 2] = 64 * l; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 1500; k++) straw(g, R() * S, R() * S, 10 + R() * 34, (R() - 0.5) * 0.5 + (R() < 0.12 ? R() * 3 : 0), 1 + R() * 1.4, strawCol(R, 0.95, 0.9), S, true);
  return c;
}

// ── the boards: the sign and the stall slots ─────────────────────────────────────────────────────────────────────────
export const BOARDS = { w: 1024, h: 512, sign: [0, 0, 1024, 192], slot: (i) => [(i % 4) * 256, 256 + Math.floor(i / 4) * 128, 256, 128], slots: 8 };
// the UVs of one region of the boards picture (u0, v0 at the bottom left: the canvas is flipped as it goes up)
export function boardUV([x, y, w, h]) { return [x / BOARDS.w, 1 - (y + h) / BOARDS.h, (x + w) / BOARDS.w, 1 - y / BOARDS.h]; }

// eat into what was just drawn with noise, so paint and chalk look worn, not printed
function wear(g, [x0, y0, w, h], amount, seed, scale = 1) {
  const img = g.getImageData(x0, y0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / 128 * scale, y / 128 * scale, 8, 8, 3, seed) * 0.75 + hash(x, y, seed) * 0.25, i = (y * w + x) * 4;
    if (n < amount) d[i + 3] = 0; else d[i + 3] *= clamp01((n - amount) * 9);
  }
  g.putImageData(img, x0, y0);
}
// the sign's boards: three cream-painted planks, each its own shade, dark seams between them, grain showing through the
// thin paint, and here and there the paint gone to the grey wood under it
function signBoard(g, [x0, y0, w, h], seed) {
  const R = rng(seed), img = g.createImageData(w, h), d = img.data, planks = 3;
  const tone = Array.from({ length: planks }, () => 0.93 + 0.12 * R()), warm = Array.from({ length: planks }, () => (R() - 0.5) * 0.06);
  for (let y = 0; y < h; y++) {
    const p = Math.min(planks - 1, Math.floor(y / h * planks)), py = (y / h * planks) - p;
    for (let x = 0; x < w; x++) {
      const u = x / w, i = (y * w + x) * 4;
      const grain = Math.sin((y * 0.9 + fbm(u, py, 6, 1, 3, seed + p * 9) * 30) * 1.3) * 0.5 + 0.5;
      const paintN = fbm(u * 2, y / h, 6, 3, 4, seed + 31) * 0.8 + 0.2 * hash(x >> 1, y >> 1, seed);
      const bare = clamp01((0.33 - paintN) * 6);                       // grey wood where the paint has gone
      const l = tone[p] * (0.95 - 0.07 * grain * (0.3 + 0.7 * bare) + 0.05 * (fbm(u, py, 20, 2, 2, seed + 5) - 0.5));
      let r = 232 * l * (1 + warm[p]), gg = 218 * l, b = 186 * l * (1 - warm[p]);
      r += (126 - r) * bare; gg += (114 - gg) * bare; b += (98 - b) * bare;
      const seam = Math.min(py, 1 - py) * h / planks;
      if (seam < 3.5) { const k = 0.32 + 0.4 * seam / 3.5; r *= k; gg *= k; b *= k; }
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  g.putImageData(img, x0, y0);
  // two nail heads at each end of every plank, a rust run under each
  for (let p = 0; p < planks; p++) for (const nx of [x0 + 22, x0 + w - 22]) {
    const ny = y0 + h * (p + 0.5) / planks + (R() - 0.5) * 6;
    g.fillStyle = 'rgba(60,44,32,0.95)'; g.beginPath(); g.arc(nx, ny, 3.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(120,70,40,0.3)'; g.fillRect(nx - 1.5, ny + 3, 3, 8 + R() * 10);
  }
}
function drawSign(g, text = ['LIVERY', '&', 'FEED']) {
  const r = BOARDS.sign;
  signBoard(g, r, 811);
  // the letters: chunky dark slab-serif capitals, the "&" as big as they are, a hair of a darker edge, then worn back a
  // little with noise (on their own layer, so the wear eats paint only)
  const L = canvasOf(r[2], r[3]), lg = L.getContext('2d');
  lg.textBaseline = 'middle'; lg.textAlign = 'left';
  const gap = 34, words = text.map((t) => t);
  let size = 150, font = (sz) => `900 ${sz}px Bitter, Georgia, serif`, widths;
  for (;;) { lg.font = font(size); widths = words.map((t) => lg.measureText(t).width); if (widths.reduce((a, b) => a + b, 0) + gap * 2 < r[2] * 0.9 || size < 60) break; size -= 4; }
  let x = (r[2] - (widths.reduce((a, b) => a + b, 0) + gap * 2)) / 2; const y = r[3] / 2 + 8;
  lg.font = font(size); lg.lineJoin = 'round';
  words.forEach((t, i) => { lg.strokeStyle = '#120c08'; lg.lineWidth = 5; lg.strokeText(t, x, y); lg.fillStyle = '#2a1d14'; lg.fillText(t, x, y); x += widths[i] + gap; });
  wear(lg, [0, 0, r[2], r[3]], 0.2, 823, 1.6);
  g.drawImage(L, r[0], r[1]);
}
// a stall's chalkboard: slate in a wooden frame, the horse's kind in chalk and its price beside a gold coin (the chalk
// laid on thick: letters drawn over twice, then worn back a little)
function drawChalk(g, slot, name, price) {
  const [x0, y0, w, h] = slot, R = rng(900 + x0 + y0);
  g.fillStyle = '#5e4630'; g.fillRect(x0, y0, w, h);                         // the frame
  g.fillStyle = '#26302b'; g.fillRect(x0 + 9, y0 + 9, w - 18, h - 18);       // the slate
  for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(220,226,214,${0.02 + R() * 0.05})`; g.beginPath(); g.ellipse(x0 + 20 + R() * (w - 40), y0 + 20 + R() * (h - 40), 10 + R() * 30, 5 + R() * 12, R() * 3, 0, 7); g.fill(); }
  const L = canvasOf(w, h), lg = L.getContext('2d');
  lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillStyle = '#f2f3ea'; lg.strokeStyle = '#f2f3ea'; lg.lineJoin = 'round';
  let ns = 40; lg.font = `800 ${ns}px Bitter, Georgia, serif`; while (lg.measureText(name).width > w - 40 && ns > 20) { ns -= 2; lg.font = `800 ${ns}px Bitter, Georgia, serif`; }
  lg.lineWidth = 2.2; lg.strokeText(name, w / 2, 37); lg.fillText(name, w / 2, 37);
  lg.font = '900 54px Bitter, Georgia, serif';
  const pw = lg.measureText(String(price)).width;
  lg.lineWidth = 2.5; lg.strokeText(String(price), w / 2 + 18, 89); lg.fillText(String(price), w / 2 + 18, 89);
  lg.lineWidth = 3.5; lg.beginPath(); lg.moveTo(30, 61); lg.lineTo(w - 30, 62); lg.stroke();
  wear(lg, [0, 0, w, h], 0.12, 931 + x0, 3);
  g.drawImage(L, x0, y0);
  // the coin: drawn in yellow chalk
  const cx = x0 + w / 2 + 18 - pw / 2 - 30, cy = y0 + 89;
  g.strokeStyle = 'rgba(244,204,92,0.95)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.stroke();
}
// a brass name plate: a gold bevelled plate, the name cut into it (dark, a bright lip under), a screw at each corner
function drawPlate(g, slot, name) {
  const [x0, y0, w, h] = slot;
  g.fillStyle = '#4e3a26'; g.fillRect(x0, y0, w, h);                         // the wooden board behind it
  const px = x0 + 14, py = y0 + 20, pw = w - 28, ph = h - 40;
  const gr = g.createLinearGradient(px, py, px + pw * 0.4, py + ph);
  gr.addColorStop(0, '#f1d58a'); gr.addColorStop(0.45, '#c89a3c'); gr.addColorStop(1, '#8c6420');
  g.fillStyle = gr; g.fillRect(px, py, pw, ph);
  g.strokeStyle = 'rgba(255,240,190,0.7)'; g.lineWidth = 2; g.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
  g.strokeStyle = 'rgba(70,46,12,0.6)'; g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${name.length > 7 ? 32 : 38}px Rye, Georgia, serif`;
  g.fillStyle = 'rgba(255,236,170,0.8)'; g.fillText(name, x0 + w / 2 + 1, y0 + h / 2 + 3);
  g.fillStyle = '#4a3312'; g.fillText(name, x0 + w / 2, y0 + h / 2 + 1);
  for (const [sx, sy] of [[px + 9, py + 9], [px + pw - 9, py + 9], [px + 9, py + ph - 9], [px + pw - 9, py + ph - 9]]) {
    g.fillStyle = '#6e4e1c'; g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,230,160,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx - 3, sy); g.lineTo(sx + 3, sy); g.stroke();
  }
}

// ── the sheriff's office: one picture of everything painted, pasted or pinned on it ─────────────────────────────────
// 1024 x 1024, on see-through (each piece is a plane laid a few mm over the boards or the wall it is on):
//   sign      "SHERIFF · JAIL" painted straight on the false front's boards: chunky dark slab letters, worn; under them
//             the ghost of an older sign ("ASSAY OFFICE", pale and mostly gone) and patches where the ochre has peeled
//             off to the old cream coat under it. Fades to nothing at its edges (no box round it)
//   posters   three WANTED posters (a face, a name, a reward; one torn half off) and small notices, aged paper, torn edges
//   hole      a bullet hole: a dark hole, splinters round it
//   map, calendar, rules, rug, blanket: for inside
export const SHERIFF_ART = {
  w: 1024, h: 1024,
  sign: [0, 0, 1024, 224],
  posters: [[0, 232, 200, 272], [204, 232, 200, 272], [408, 232, 200, 272]],
  notices: [[612, 232, 132, 172], [748, 232, 132, 172], [884, 232, 132, 172], [612, 408, 132, 96]],
  holes: [[748, 408, 64, 64], [816, 408, 64, 64]],
  map: [0, 512, 448, 320], calendar: [452, 512, 160, 216], rules: [616, 512, 168, 216], rug: [788, 512, 236, 320],
  blanket: [0, 840, 512, 176], hat: [520, 840, 96, 96],
};
// the UVs of a region of a picture W x H (u0, v0 at the bottom left: the canvas is flipped as it goes up)
export function regionUV([x, y, w, h], W = 1024, H = 1024) { return [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]; }

// a mask that eats in from a region's edges, raggedly (torn paper, a sign's fade): 1 inside, 0 at the edge
function raggedEdge(x, y, w, h, seed, depth, rough) {
  const d = Math.min(x, y, w - 1 - x, h - 1 - y), n = fbm(x / 64, y / 64, 8, 8, 3, seed) - 0.5;
  return clamp01((d - depth * (0.5 + n * rough * 2)) / 2.5);
}
// THE SIGN, PAINTED STRAIGHT ON THE BOARDS (the board shader lays it on the false front's lap siding, parts.js
// boardWear: so the boards' seams, laps, wear and light run through it). 1024 x 256 for 5.6 x 1.4 m of wall. Three
// coats, oldest first:
//   the old sign  "ASSAY OFFICE" in faded brick red, a decorative face, offset up and left of the new one; faint where it
//                 lies on the wall, a little stronger where the cream over it has flaked
//   the cream     the new sign's ground, brushed on without a frame: it feathers out unevenly into the wall's ochre,
//                 thins in streaks along the boards and has flaked off in patches
//   the letters   "SHERIFF · JAIL": chunky dark slab capitals, worn back, a few drips
// Returned as raw pixels (rgb the paint's colour everywhere, cream where there is none, so its edges blend clean; a how
// much paint), not through a canvas, which would lose the colour where there is no paint.
export const SIGN_PAINT = { w: 1024, h: 256, m: [5.6, 1.4] };
function signMask(draw) { const c = canvasOf(SIGN_PAINT.w, SIGN_PAINT.h), g = c.getContext('2d', { willReadFrequently: true }); draw(g); const d = g.getImageData(0, 0, SIGN_PAINT.w, SIGN_PAINT.h).data, a = new Float32Array(SIGN_PAINT.w * SIGN_PAINT.h); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255; return a; }
function paintedSign() {
  const { w, h } = SIGN_PAINT, ppm = w / SIGN_PAINT.m[0], cy = h / 2 + 5;
  // the old sign's letters
  const ghost = signMask((gg) => {
    gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = '#000';
    // (bigger than the new letters and higher: its tops stand clear of the cream, on the bare ochre)
    let gs = 150; gg.font = `400 ${gs}px Rye, Georgia, serif`;
    while (gg.measureText('ASSAY OFFICE').width > w * 0.9 && gs > 50) { gs -= 4; gg.font = `400 ${gs}px Rye, Georgia, serif`; }
    gg.fillText('ASSAY OFFICE', w / 2 - 0.3 * ppm, cy - 0.27 * ppm);
    wear(gg, [0, 0, w, h], 0.26, 1231, 2.4);
  });
  // the new letters
  const letters = signMask((tg) => {
    tg.textBaseline = 'middle'; tg.textAlign = 'left'; tg.fillStyle = '#000'; tg.strokeStyle = '#000'; tg.lineJoin = 'round';
    const words = ['SHERIFF', 'JAIL'], gap = 110, font = (sz) => `900 ${sz}px Bitter, Georgia, serif`;
    const track = (t, sz) => [...t].reduce((a, c) => a + tg.measureText(c).width, 0) + (t.length - 1) * sz * 0.07;
    let size = 168, widths;
    for (;;) { tg.font = font(size); widths = words.map((t) => track(t, size)); if (widths[0] + widths[1] + gap < w * 0.76 || size < 70) break; size -= 4; }
    let x = (w - (widths[0] + widths[1] + gap)) / 2;
    words.forEach((t, wi) => {
      for (const c of t) { const yy = cy + Math.sin(x * 0.07) * 2; tg.lineWidth = 5; tg.strokeText(c, x, yy); tg.fillText(c, x, yy); x += tg.measureText(c).width + size * 0.07; }
      x -= size * 0.07;
      if (wi === 0) { tg.beginPath(); tg.arc(x + gap / 2, cy + 3, size * 0.085, 0, 7); tg.fill(); x += gap; }
    });
    wear(tg, [0, 0, w, h], 0.16, 1241, 1.7);
    const R = rng(1251);
    for (let k = 0; k < 9; k++) tg.fillRect(w * (0.14 + 0.72 * R()), cy + size * 0.34, 2.5, 6 + R() * 16);
  });
  const CREAM = [228, 216, 186], RED = [122, 54, 38], INK = [40, 28, 20];
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, i = y * w + x;
    // the cream: a soft-edged patch round the lettering (its half-size 2.5 x 0.5 m), its edge wandering 10 to 40 cm in
    // and out, then thinned in long streaks along the boards and flaked off in patches
    const dx = Math.max(0, Math.abs(x - w / 2) - 2.45 * ppm), dy = Math.max(0, Math.abs(y - cy) - 0.42 * ppm);
    const wob = (fbm(u * 2, v * 1.5, 5, 3, 4, 1203) - 0.5) * 0.5 * ppm + (fbm(u * 6, v * 4, 9, 5, 2, 1207) - 0.5) * 0.12 * ppm;
    const d = Math.hypot(dx, dy * 1.6) - wob;
    let cream = 1 - smoothstepJS(0, 0.16 * ppm, d);
    const streak = fbm(u * 1.0, v * 7.0, 4, 9, 4, 1213), flake = fbm(u * 2.2, v * 6.5, 9, 11, 3, 1219) * 0.75 + hash(x >> 1, y >> 1, 1221) * 0.25;
    cream *= 0.62 + 0.38 * smoothstepJS(0.3, 0.6, streak);
    if (flake < 0.34) cream *= 0.08;                                   // flaked off (crisp-edged)
    else if (flake < 0.38) cream *= 0.5;
    const gA = 0.42 * ghost[i] * (1 - 0.5 * cream), lA = letters[i] * (0.35 + 0.65 * smoothstepJS(0.2, 0.6, cream + 0.4));
    // over: the old letters, the cream (the old letters bleeding faintly through it), the new letters
    let A = gA, Cr = RED[0] * gA, Cg = RED[1] * gA, Cb = RED[2] * gA;
    const bleed = 0.24 * ghost[i], cc = [CREAM[0] + (RED[0] - CREAM[0]) * bleed, CREAM[1] + (RED[1] - CREAM[1]) * bleed, CREAM[2] + (RED[2] - CREAM[2]) * bleed], cn = 0.94 + 0.1 * (fbm(u, v, 18, 5, 2, 1223) - 0.5);
    const ca = cream * 0.94;
    Cr = cc[0] * cn * ca + Cr * (1 - ca); Cg = cc[1] * cn * ca + Cg * (1 - ca); Cb = cc[2] * cn * ca + Cb * (1 - ca); A = ca + A * (1 - ca);
    Cr = INK[0] * lA + Cr * (1 - lA); Cg = INK[1] * lA + Cg * (1 - lA); Cb = INK[2] * lA + Cb * (1 - lA); A = lA + A * (1 - lA);
    // (rows go in bottom first: v runs up the wall)
    const o = ((h - 1 - y) * w + x) * 4;
    if (A > 0.004) { data[o] = Cr / A; data[o + 1] = Cg / A; data[o + 2] = Cb / A; } else { data[o] = CREAM[0]; data[o + 1] = CREAM[1]; data[o + 2] = CREAM[2]; }
    data[o + 3] = Math.round(255 * Math.min(1, A));
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function smoothstepJS(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
// aged paper: cream going yellow-brown at the edges, stains, a fold line or two; its outline torn
function paper(g, [x0, y0, w, h], seed, o = {}) {
  const img = g.createImageData(w, h), d = img.data, R = rng(seed);
  const base = o.base || [226, 212, 172], tearY = o.tear ? h * o.tear : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, i = (y * w + x) * 4;
    const edge = Math.min(u, 1 - u, v, 1 - v), burn = 1 - smoothstep(0, 0.12, edge);
    const n = fbm(u, v, 6, 8, 4, seed), st = fbm(u, v, 3, 3, 3, seed + 7);
    const l = 0.92 + 0.12 * (n - 0.5) - 0.22 * burn - 0.18 * clamp01((st - 0.62) * 4);
    d[i] = base[0] * l; d[i + 1] = base[1] * l * (1 - 0.06 * burn); d[i + 2] = base[2] * l * (1 - 0.18 * burn);
    let a = raggedEdge(x, y, w, h, seed + 11, 3, 1.2);
    // torn across: everything under a jagged line gone
    if (tearY !== null) { const ty = tearY + (fbm(u * 3, 0, 12, 1, 3, seed + 13) - 0.5) * h * 0.22 + (u - 0.5) * h * 0.18; if (y > ty) a = 0; else a *= clamp01((ty - y) / 2); }
    d[i + 3] = 255 * a;
  }
  g.putImageData(img, x0, y0);
  // fold lines
  for (let f = 0; f < (o.folds ?? 1); f++) { const fy = y0 + h * (0.35 + 0.3 * R()); g.fillStyle = 'rgba(90,70,40,0.12)'; g.fillRect(x0 + 4, fy, w - 8, 2); g.fillStyle = 'rgba(255,250,230,0.12)'; g.fillRect(x0 + 4, fy + 2, w - 8, 1); }
}
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
// the text on a paper, in the paper's own layer (so the tear and the edges cut it too): clipped to the paper's alpha
function onPaper(g, [x0, y0, w, h], draw) {
  const P = canvasOf(w, h), pg = P.getContext('2d');
  draw(pg, w, h);
  pg.globalCompositeOperation = 'destination-in'; pg.drawImage(g.canvas, x0, y0, w, h, 0, 0, w, h);
  g.drawImage(P, x0, y0);
}
const INK = '#2a1f16';
// lines of small print: grey bars of words
function printLines(pg, x, y, w, rows, R, step = 9) {
  pg.fillStyle = 'rgba(42,31,22,0.62)';
  for (let r = 0; r < rows; r++) { let cx = x; const ex = x + w * (r === rows - 1 ? 0.55 + 0.3 * R() : 1); while (cx < ex - 6) { const ww = Math.min(6 + R() * 18, ex - cx); pg.fillRect(cx, y + r * step, ww, 3.2); cx += ww + 4; } }
}
// a face sketched in ink: shoulders, a head, a wide-brimmed hat, eyes, a moustache (a friendly one: this is for kids)
function face(pg, cx, cy, s, R) {
  pg.fillStyle = 'rgba(60,45,30,0.16)'; pg.fillRect(cx - s * 1.3, cy - s * 1.6, s * 2.6, s * 2.9);   // the sketch's shaded box
  pg.strokeStyle = INK; pg.fillStyle = INK; pg.lineWidth = 2;
  pg.beginPath(); pg.moveTo(cx - s * 1.2, cy + s * 1.3); pg.quadraticCurveTo(cx - s * 1.1, cy + s * 0.55, cx - s * 0.3, cy + s * 0.5); pg.lineTo(cx + s * 0.3, cy + s * 0.5); pg.quadraticCurveTo(cx + s * 1.1, cy + s * 0.55, cx + s * 1.2, cy + s * 1.3); pg.stroke();
  pg.fillStyle = 'rgba(222,200,160,0.9)'; pg.beginPath(); pg.ellipse(cx, cy, s * 0.48, s * 0.6, 0, 0, 7); pg.fill(); pg.stroke();
  pg.fillStyle = INK;
  pg.beginPath(); pg.ellipse(cx, cy - s * 0.52, s * 1.0, s * 0.16, 0, 0, 7); pg.fill();                   // the brim
  pg.beginPath(); pg.moveTo(cx - s * 0.5, cy - s * 0.55); pg.quadraticCurveTo(cx - s * 0.48, cy - s * 1.15, cx, cy - s * 1.1); pg.quadraticCurveTo(cx + s * 0.48, cy - s * 1.15, cx + s * 0.5, cy - s * 0.55); pg.fill();   // the crown
  for (const ex of [-0.18, 0.18]) { pg.beginPath(); pg.arc(cx + ex * s, cy - s * 0.12, s * 0.055, 0, 7); pg.fill(); }
  pg.beginPath(); pg.moveTo(cx - s * 0.26, cy + s * 0.2); pg.quadraticCurveTo(cx, cy + s * 0.08, cx + s * 0.26, cy + s * 0.2); pg.quadraticCurveTo(cx, cy + s * (0.26 + 0.05 * R()), cx - s * 0.26, cy + s * 0.2); pg.fill();   // moustache
  pg.lineWidth = 1.5; pg.beginPath(); pg.moveTo(cx - s * 0.04, cy - s * 0.05); pg.lineTo(cx - s * 0.08, cy + s * 0.1); pg.lineTo(cx + s * 0.03, cy + s * 0.11); pg.stroke();   // nose
}
function wantedPoster(g, r, o) {
  paper(g, r, o.seed, { tear: o.tear, folds: 2 });
  onPaper(g, r, (pg, w, h) => {
    const R = rng(o.seed + 3);
    pg.textAlign = 'center'; pg.textBaseline = 'alphabetic'; pg.fillStyle = INK;
    pg.font = `400 ${Math.round(w * 0.2)}px Rye, Georgia, serif`; pg.fillText('WANTED', w / 2, h * 0.15);
    pg.fillRect(w * 0.1, h * 0.18, w * 0.8, 2);
    face(pg, w / 2, h * 0.39, w * 0.17, R);
    pg.font = `800 ${Math.round(w * 0.085)}px Bitter, Georgia, serif`; pg.fillText(o.name, w / 2, h * 0.64);
    pg.font = `400 ${Math.round(w * 0.13)}px Rye, Georgia, serif`; pg.fillText('REWARD', w / 2, h * 0.76);
    pg.font = `900 ${Math.round(w * 0.12)}px Bitter, Georgia, serif`; pg.fillText(o.reward, w / 2, h * 0.87);
    printLines(pg, w * 0.14, h * 0.9, w * 0.72, 2, R, 8);
  });
  wear(g, r, 0.04, o.seed + 5, 3);
}
function notice(g, r, o) {
  paper(g, r, o.seed, { base: o.base, folds: 1 });
  onPaper(g, r, (pg, w, h) => {
    const R = rng(o.seed + 3);
    pg.textAlign = 'center'; pg.fillStyle = INK;
    pg.font = `800 ${Math.round(w * 0.13)}px Bitter, Georgia, serif`; pg.fillText(o.title, w / 2, h * 0.2);
    if (o.big) { pg.font = `400 ${Math.round(w * 0.2)}px Rye, Georgia, serif`; pg.fillText(o.big, w / 2, h * 0.42); }
    printLines(pg, w * 0.12, h * (o.big ? 0.52 : 0.32), w * 0.76, o.big ? 5 : 8, R, 9);
  });
}
// a bullet hole: dark and ragged in the middle, splinters of paler wood round it, a scorch of dirt
function bulletHole(g, [x0, y0, w, h], seed) {
  const R = rng(seed), cx = x0 + w / 2, cy = y0 + h / 2;
  g.clearRect(x0, y0, w, h);
  const gr = g.createRadialGradient(cx, cy, 2, cx, cy, w * 0.45);
  gr.addColorStop(0, 'rgba(40,28,18,0.55)'); gr.addColorStop(1, 'rgba(40,28,18,0)');
  g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  for (let k = 0; k < 13; k++) {
    const a = R() * Math.PI * 2, L = w * (0.2 + 0.24 * R());
    g.strokeStyle = `rgba(${200 + R() * 30 | 0},${178 + R() * 30 | 0},${140 + R() * 20 | 0},0.85)`; g.lineWidth = 1.5 + R() * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.6); g.stroke();
  }
  // (a ring of torn, darker wood round the hole, then the hole itself, ragged)
  g.fillStyle = 'rgba(52,36,24,0.9)'; g.beginPath();
  for (let k = 0; k <= 11; k++) { const a = k / 11 * Math.PI * 2, rr = w * (0.17 + 0.06 * R()); g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.fill();
  g.fillStyle = '#0a0705'; g.beginPath();
  for (let k = 0; k <= 9; k++) { const a = k / 9 * Math.PI * 2, rr = w * (0.11 + 0.04 * R()); g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.fill();
}
// the valley drawn by hand on parchment: a river, hills, the trail, the town, a compass
function valleyMap(g, r) {
  paper(g, r, 1301, { base: [222, 204, 160], folds: 2 });
  onPaper(g, r, (pg, w, h) => {
    const R = rng(1303);
    pg.strokeStyle = 'rgba(70,90,110,0.85)'; pg.lineWidth = 5;
    pg.beginPath(); pg.moveTo(w * 0.05, h * 0.25); pg.bezierCurveTo(w * 0.35, h * 0.1, w * 0.4, h * 0.7, w * 0.95, h * 0.62); pg.stroke();
    pg.strokeStyle = 'rgba(110,80,50,0.8)'; pg.lineWidth = 2.5; pg.setLineDash([7, 5]);
    pg.beginPath(); pg.moveTo(w * 0.1, h * 0.9); pg.bezierCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 0.95, w * 0.75, h * 0.3); pg.stroke(); pg.setLineDash([]);
    pg.fillStyle = 'rgba(60,45,30,0.75)';
    for (let k = 0; k < 9; k++) { const x = w * (0.55 + 0.4 * R()), y = h * (0.08 + 0.2 * R()); pg.beginPath(); pg.moveTo(x - 16, y + 12); pg.lineTo(x, y - 10); pg.lineTo(x + 16, y + 12); pg.closePath(); pg.fill(); }
    for (let k = 0; k < 14; k++) { const x = w * (0.05 + 0.3 * R()), y = h * (0.45 + 0.3 * R()); pg.beginPath(); pg.arc(x, y, 5 + R() * 3, 0, 7); pg.fill(); }
    pg.fillStyle = 'rgba(150,40,30,0.9)'; for (const [x, y] of [[0.52, 0.48], [0.56, 0.5], [0.5, 0.53], [0.55, 0.55], [0.6, 0.47]]) pg.fillRect(w * x, h * y, 10, 8);
    pg.fillStyle = INK; pg.textAlign = 'center'; pg.font = '400 30px Rye, Georgia, serif'; pg.fillText('MATHWOOD VALLEY', w / 2, h * 0.93);
    pg.font = '700 15px Bitter, Georgia, serif'; pg.fillText('TOWN', w * 0.55, h * 0.45);
    pg.strokeStyle = INK; pg.lineWidth = 2; pg.beginPath(); pg.arc(w * 0.88, h * 0.82, 20, 0, 7); pg.moveTo(w * 0.88, h * 0.82 - 28); pg.lineTo(w * 0.88, h * 0.82 + 28); pg.moveTo(w * 0.88 - 28, h * 0.82); pg.lineTo(w * 0.88 + 28, h * 0.82); pg.stroke();
    pg.font = '800 13px Bitter, Georgia, serif'; pg.fillText('N', w * 0.88, h * 0.82 - 32);
  });
}
function calendar(g, r) {
  paper(g, r, 1311, { base: [232, 222, 196], folds: 0 });
  onPaper(g, r, (pg, w, h) => {
    pg.textAlign = 'center'; pg.fillStyle = 'rgba(140,40,30,0.95)'; pg.font = '400 30px Rye, Georgia, serif'; pg.fillText('MAY', w / 2, 40);
    pg.fillStyle = INK; pg.font = '700 16px Bitter, Georgia, serif'; pg.fillText('1881', w / 2, 62);
    pg.strokeStyle = 'rgba(42,31,22,0.55)'; pg.lineWidth = 1;
    const gx = 12, gy = 74, cw = (w - 24) / 7, ch = (h - 86) / 5;
    for (let i = 0; i <= 7; i++) { pg.beginPath(); pg.moveTo(gx + i * cw, gy); pg.lineTo(gx + i * cw, gy + 5 * ch); pg.stroke(); }
    for (let j = 0; j <= 5; j++) { pg.beginPath(); pg.moveTo(gx, gy + j * ch); pg.lineTo(gx + 7 * cw, gy + j * ch); pg.stroke(); }
    pg.font = '600 11px Bitter, Georgia, serif'; pg.fillStyle = INK;
    for (let dd = 1; dd <= 31; dd++) { const c = (dd + 6) % 7, rr = Math.floor((dd + 6) / 7); if (rr > 4) continue; pg.fillText(String(dd), gx + c * cw + cw * 0.5, gy + rr * ch + 13); }
    pg.strokeStyle = 'rgba(42,31,22,0.8)'; pg.lineWidth = 1.6;
    for (let dd = 1; dd <= 17; dd++) { const c = (dd + 6) % 7, rr = Math.floor((dd + 6) / 7); const cx = gx + c * cw, cy = gy + rr * ch; pg.beginPath(); pg.moveTo(cx + 4, cy + 4); pg.lineTo(cx + cw - 4, cy + ch - 4); pg.stroke(); }
  });
}
function jailRules(g, r) {
  paper(g, r, 1321, { base: [230, 218, 184], folds: 1 });
  onPaper(g, r, (pg, w, h) => {
    pg.textAlign = 'center'; pg.fillStyle = INK; pg.font = '400 24px Rye, Georgia, serif'; pg.fillText('JAIL RULES', w / 2, 38);
    pg.fillRect(w * 0.15, 48, w * 0.7, 2);
    pg.textAlign = 'left'; pg.font = '700 13px Bitter, Georgia, serif';
    ['1. WIPE YOUR BOOTS', '2. NO SPITTING', '3. NO SINGING', '    AFTER DARK', '4. NO ESCAPING', '5. SAY PLEASE'].forEach((t, i) => pg.fillText(t, 14, 78 + i * 22));
  });
}
// a woven rug: bands and stepped diamonds in red, cream, black and grey, worn pale in the middle, a fringe at the ends
function rug(g, [x0, y0, w, h]) {
  const img = g.createImageData(w, h), d = img.data;
  const C = { r: [150, 46, 32], c: [214, 196, 160], k: [40, 32, 28], g: [120, 112, 100] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, i = (y * w + x) * 4;
    const fringe = v < 0.04 || v > 0.96;
    const bv = Math.abs(v - 0.5) * 2, dia = Math.abs(u - 0.5) * 2 + Math.abs(((v * 3) % 1) - 0.5) * 2;
    let c = bv > 0.82 ? C.k : bv > 0.74 ? C.c : dia < 0.35 ? C.k : dia < 0.55 ? C.c : dia < 0.75 ? C.r : (Math.floor(v * 24) % 2 ? C.g : C.r);
    if (Math.abs(u - 0.5) > 0.44) c = C.k;
    const wv = 0.88 + 0.12 * Math.sin(x * 1.7) * Math.sin(y * 1.3) + 0.1 * (fbm(u, v, 6, 6, 3, 1331) - 0.5) + 0.12 * (1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2.4));
    d[i] = c[0] * wv; d[i + 1] = c[1] * wv; d[i + 2] = c[2] * wv;
    d[i + 3] = fringe ? (x % 5 < 2 ? 200 : 0) : 255;
    if (fringe) { d[i] = 200; d[i + 1] = 186; d[i + 2] = 150; }
  }
  g.putImageData(img, x0, y0);
}
// a grey wool blanket, two dark stripes near each end
function blanket(g, [x0, y0, w, h]) {
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, i = (y * w + x) * 4, st = (u > 0.08 && u < 0.12) || (u > 0.15 && u < 0.17) || (u > 0.83 && u < 0.85) || (u > 0.88 && u < 0.92);
    const l = (st ? 0.35 : 1) * (0.86 + 0.14 * fbm(x / w, y / h, 12, 4, 3, 1341) + 0.05 * Math.sin(x * 2.3 + y * 1.9));
    d[i] = 120 * l; d[i + 1] = 112 * l; d[i + 2] = 98 * l; d[i + 3] = 255;
  }
  g.putImageData(img, x0, y0);
}
export async function makeSheriffArt() {
  try { await Promise.all([document.fonts.load('64px Rye'), document.fonts.load('900 64px Bitter'), document.fonts.load('800 40px Bitter'), document.fonts.load('700 16px Bitter')]); } catch (e) { /* the fonts are optional */ }
  const t0 = performance.now(), A = SHERIFF_ART, c = canvasOf(A.w, A.h), g = c.getContext('2d', { willReadFrequently: true });
  const names = [['DUSTY PETE', '$500'], ['ONE-EYED JACK', '$300'], ['THE KID', '$200']];
  A.posters.forEach((r, i) => wantedPoster(g, r, { seed: 1401 + i * 17, name: names[i][0], reward: names[i][1], tear: i === 2 ? 0.55 : null }));
  [['NOTICE', null, null], ['REWARD', '$50', [236, 226, 196]], ['LOST HORSE', null, [214, 200, 168]], ['NOTICE', null, [226, 214, 184]]].forEach(([t, big, base], i) => notice(g, A.notices[i], { seed: 1501 + i * 13, title: t, big, base }));
  A.holes.forEach((r, i) => bulletHole(g, r, 1601 + i));
  valleyMap(g, A.map); calendar(g, A.calendar); jailRules(g, A.rules); rug(g, A.rug); blanket(g, A.blanket);
  const t = tex(c, { repeat: false, aniso: 8 });
  const signPaint = paintedSign();
  return { sheriff: t, signPaint, bytes: gpuBytes(A.w, A.h) + gpuBytes(SIGN_PAINT.w, SIGN_PAINT.h), ms: performance.now() - t0 };
}

// all of the lab's own pictures. boards.slotFor(i, { name, price, owned }) draws slot i again (and sends it up)
export async function makeArt() {
  try { await Promise.all([document.fonts.load('64px Rye'), document.fonts.load('30px Smokum'), document.fonts.load('900 64px Bitter'), document.fonts.load('800 40px Bitter')]); } catch (e) { /* the fonts are optional */ }
  const t0 = performance.now();
  const bc = canvasOf(BOARDS.w, BOARDS.h), bg = bc.getContext('2d');
  bg.fillStyle = '#3a2c20'; bg.fillRect(0, 0, BOARDS.w, BOARDS.h);
  drawSign(bg);
  const boards = tex(bc, { repeat: false, aniso: 8 });
  boards.slotFor = (i, o) => {
    const s = BOARDS.slot(i);
    if (o.owned) drawPlate(bg, s, o.plate); else drawChalk(bg, s, o.label, o.price);
    boards.needsUpdate = true;
  };
  const floor = tex(drawFloor()), spill = tex(drawSpill(), { repeat: false }), hay = tex(drawHay());
  const list = [
    { name: 'Sign and stall boards', canvas: bc }, { name: 'Barn floor', canvas: floor.image },
    { name: 'Loose straw', canvas: spill.image }, { name: 'Hay', canvas: hay.image },
  ];
  for (const L of list) L.bytes = gpuBytes(L.canvas.width, L.canvas.height);
  return { boards, floor, spill, hay, list, bytes: list.reduce((s, L) => s + L.bytes, 0), ms: performance.now() - t0 };
}

// ── the general store: one picture of its goods and everything pasted, painted or framed in it ─────────────────────
// 1024 x 1024. The opaque regions are faces of the goods (goods.js: tins wrap a label once round, sacks wear a print on
// their front, bolts of cloth their pattern, heaps of apples are seen from above); the see-through ones are laid over
// boards as decals (posters, the price board, the stencils on crates, the brass drawer labels).
//   burlap, flour, coffee      sacks: plain burlap; cream cotton printed FLOUR; burlap stencilled COFFEE (256 each)
//   cloth[4]                   gingham, calico, plaid, ticking (128 each, they tile)
//   tins[16]                   labels 128 x 64, wrapped once round a tin (the middle of the picture faces out)
//   boxes[8]                   packets' fronts, 128 x 128
//   tile                       64 x 64 plain stuff: tin, dark wood, leathers, brass, enamel, cast iron, glass, candy
//                              sticks, cotton, kraft paper, cheese wax, hat felt, rope, crate wood, coal
//   heaps[8]                   seen from above, 128 x 128: apples, crackers, candy drops, coffee beans, potatoes, nails,
//                              peppermints, pickles
//   board, posters[2], pictures[2], flag, checker, labels[16], stencils, books, ornate (the till's embossed brass), keg
export const STORE_ART = {
  w: 1024, h: 1024,
  burlap: [0, 0, 256, 256], flour: [256, 0, 256, 256], coffee: [512, 0, 256, 256],
  cloth: [[768, 0, 128, 128], [896, 0, 128, 128], [768, 128, 128, 128], [896, 128, 128, 128]],
  tins: Array.from({ length: 16 }, (_, i) => [(i % 8) * 128, 256 + Math.floor(i / 8) * 64, 128, 64]),
  boxes: Array.from({ length: 8 }, (_, i) => [i * 128, 384, 128, 128]),
  tile: Object.fromEntries(['tin', 'darkwood', 'leather', 'leatherBlack', 'brass', 'enamel', 'castIron', 'glass', 'candy', 'cotton', 'kraft', 'wax', 'felt', 'rope', 'crate', 'coal'].map((k, i) => [k, [i * 64, 512, 64, 64]])),
  heaps: Object.fromEntries(['apples', 'crackers', 'drops', 'beans', 'potatoes', 'nails', 'mints', 'pickles'].map((k, i) => [k, [i * 128, 576, 128, 128]])),
  board: [0, 704, 384, 224], posters: [null, [544, 704, 160, 224]], keys: [384, 704, 160, 64], candy: [384, 768, 128, 128],
  pictures: [[704, 704, 160, 112], [864, 704, 160, 112]], flag: [704, 816, 160, 112], checker: [864, 816, 112, 112],
  labels: Array.from({ length: 16 }, (_, i) => [(i % 8) * 64, 928 + Math.floor(i / 8) * 48, 64, 48]),
  stencils: { APPLES: [512, 928, 192, 48], CRACKERS: [512, 976, 192, 48] }, books: [704, 928, 160, 96], ornate: [864, 928, 160, 96],
  keg: [976, 816, 48, 112],
};
// fill a region pixel by pixel: f(u, v, x, y) -> [r, g, b] (0..255) or [r, g, b, a]
function pixels(g, [x0, y0, w, h], f) {
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x / w, y / h, x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255; }
  g.putImageData(img, x0, y0);
}
// cloth: a coarse weave (threads 4 px), its own colour, flecks of fibre, soft blotches
function weave(base, seed, thread = 4, depth = 0.16) {
  return (u, v, x, y) => {
    const over = ((Math.floor(x / thread) + Math.floor(y / thread)) & 1) === 0, t = over ? Math.sin((x % thread + 0.5) / thread * Math.PI) : Math.sin((y % thread + 0.5) / thread * Math.PI);
    const l = (1 - depth) + depth * t + 0.08 * (fbm(u, v, 6, 6, 3, seed) - 0.5) + 0.06 * (hash(x, y, seed) - 0.5);
    return [base[0] * l, base[1] * l, base[2] * l];
  };
}
// text fitted to a width: the biggest size up to `size` that fits
function fitText(g, t, x, y, maxW, size, font, o = {}) {
  let s = size; g.font = font(s); while (g.measureText(t).width > maxW && s > 6) { s -= 1; g.font = font(s); }
  if (o.stroke) { g.lineWidth = o.stroke; g.strokeText(t, x, y); }
  g.fillText(t, x, y); return s;
}
const SLAB = (w = 900) => (s) => `${w} ${s}px Bitter, Georgia, serif`, RYE = (s) => `400 ${s}px Rye, Georgia, serif`;
// a print on cloth: ink soaked in unevenly, broken where the weave is high
function inkOn(g, r, draw, seed, alpha = 0.85) {
  const L = canvasOf(r[2], r[3]), lg = L.getContext('2d'); draw(lg, r[2], r[3]);
  wear(lg, [0, 0, r[2], r[3]], 0.1, seed, 2.5);
  g.globalAlpha = alpha; g.drawImage(L, r[0], r[1]); g.globalAlpha = 1;
}
function sackPrints(g, A) {
  pixels(g, A.burlap, weave([150, 122, 84], 2001));
  pixels(g, A.flour, weave([200, 182, 146], 2003, 3, 0.14));
  pixels(g, A.coffee, weave([140, 112, 76], 2005));
  // THE SACKS' LABELS (each laid once across a patch on a sack's front, a little wider than tall: drawn stretched up to
  // match): FLOUR in faded indigo between brick lines, the mill's name; COFFEE stencilled in brick on the burlap. Inks
  // soaked in thin and worn
  inkOn(g, A.flour, (lg, w, h) => {
    lg.save(); lg.translate(0, h / 2); lg.scale(1, 1.55); lg.translate(0, -h / 2);
    lg.textAlign = 'center'; lg.textBaseline = 'middle';
    lg.strokeStyle = 'rgba(132,58,44,0.8)'; lg.lineWidth = 2.5; lg.strokeRect(w * 0.08, h * 0.2, w * 0.84, h * 0.6); lg.lineWidth = 1; lg.strokeRect(w * 0.11, h * 0.23, w * 0.78, h * 0.54);
    lg.fillStyle = 'rgba(132,58,44,0.85)'; fitText(lg, 'XXXX', w / 2, h * 0.32, w * 0.4, 24, SLAB());
    lg.fillStyle = 'rgba(54,66,98,0.88)'; fitText(lg, 'FLOUR', w / 2, h * 0.5, w * 0.7, 54, SLAB());
    lg.fillStyle = 'rgba(132,58,44,0.85)'; fitText(lg, 'VALLEY MILLS', w / 2, h * 0.66, w * 0.6, 16, SLAB(800));
    lg.restore();
  }, 2007, 0.75);
  inkOn(g, A.coffee, (lg, w, h) => {
    lg.save(); lg.translate(0, h / 2); lg.scale(1, 1.55); lg.translate(0, -h / 2);
    lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillStyle = 'rgba(126,52,38,0.9)';
    fitText(lg, 'COFFEE', w / 2, h * 0.44, w * 0.76, 52, SLAB());
    lg.fillStyle = 'rgba(30,24,18,0.8)'; fitText(lg, 'SANTOS', w / 2, h * 0.6, w * 0.4, 18, SLAB(800));
    lg.restore();
  }, 2009, 0.8);
}
function clothPatterns(g, A) {
  const [gin, cal, pla, tick] = A.cloth;
  // red gingham: two sets of red bands crossing, darker where they cross
  pixels(g, gin, (u, v, x, y) => { const a = (x % 16) < 8, b = (y % 16) < 8, k = (a ? 1 : 0) + (b ? 1 : 0); const w = weave([1, 1, 1], 2011, 2, 0.1)(u, v, x, y)[0]; return [[236, 228, 214], [196, 70, 58], [140, 34, 30]][k].map((c) => c * w); });
  // blue calico: small cream flowers scattered on dark blue
  pixels(g, cal, (u, v, x, y) => { const w = weave([1, 1, 1], 2013, 2, 0.1)(u, v, x, y)[0]; let c = [46, 66, 118]; for (let k = 0; k < 18; k++) { const cx = (hash(k, 1, 2015) * 128), cy = (hash(k, 2, 2015) * 128); let dx = Math.abs(x - cx), dy = Math.abs(y - cy); dx = Math.min(dx, 128 - dx); dy = Math.min(dy, 128 - dy); const d = Math.hypot(dx, dy); if (d < 4.5) c = d < 1.6 ? [210, 170, 70] : [226, 214, 186]; } return c.map((q) => q * w); });
  // brown plaid
  pixels(g, pla, (u, v, x, y) => { const w = weave([1, 1, 1], 2017, 2, 0.1)(u, v, x, y)[0], a = (x % 32), b = (y % 32); let c = [120, 84, 52]; if (a < 10 || b < 10) c = [92, 60, 36]; if ((a < 10) && (b < 10)) c = [62, 40, 26]; if (a === 20 || b === 20 || a === 21 || b === 21) c = [196, 160, 96]; return c.map((q) => q * w); });
  // blue and white ticking
  pixels(g, tick, (u, v, x, y) => { const w = weave([1, 1, 1], 2019, 2, 0.08)(u, v, x, y)[0], a = x % 21; const c = a < 3 ? [52, 70, 112] : a === 6 || a === 15 ? [96, 112, 150] : [222, 216, 200]; return c.map((q) => q * w); });
}
// THE LABELS, as an 1880s grocer's shelves had them: cream paper printed in one or two muted inks (oxblood, faded
// indigo, ochre, olive, umber, slate), an engraved picture in an oval, the name in Clarendon or Tuscan letters; then the
// whole lot faded a little more (mute)
const INKS = { oxblood: [112, 42, 34], indigo: [56, 68, 98], ochre: [164, 118, 50], olive: [92, 98, 54], umber: [100, 70, 44], slate: [78, 86, 92], rose: [140, 78, 66] };
const TINS = [
  ['PEACHES', 'ochre', 'fruit'], ['TOMATOES', 'oxblood', 'fruit'], ['OYSTERS', 'indigo', 'shell'], ['BEANS', 'umber', 'dots'],
  ['CORN', 'olive', 'dots'], ['LARD', 'slate', 'pail'], ['COFFEE', 'umber', 'bean'], ['BAKING POWDER', 'indigo', 'tin'],
  ['SALMON', 'rose', 'fish'], ['CONDENSED MILK', 'indigo', 'cow'], ['TEA', 'olive', 'leaf'], ['MUSTARD', 'ochre', 'pot'],
  ['SYRUP', 'umber', 'pot'], ['SARDINES', 'slate', 'fish'], ['PEAS', 'olive', 'dots'], ['SPICE', 'oxblood', 'leaf'],
];
const PAPER = [222, 208, 174];
// an engraved picture in dark ink, small, centred at (cx, cy), size s
function engraving(lg, kind, cx, cy, s, ink) {
  lg.strokeStyle = lg.fillStyle = `rgb(${ink})`; lg.lineWidth = 1;
  if (kind === 'fruit') { lg.beginPath(); lg.arc(cx, cy + 1, s * 0.55, 0, 7); lg.stroke(); for (let k = -2; k <= 2; k++) { lg.beginPath(); lg.arc(cx, cy + 1, s * 0.55, -0.9 + k * 0.12, 0.2 + k * 0.12); lg.stroke(); } lg.beginPath(); lg.moveTo(cx, cy - s * 0.4); lg.quadraticCurveTo(cx + s * 0.4, cy - s * 0.8, cx + s * 0.6, cy - s * 0.5); lg.stroke(); }
  else if (kind === 'fish') { lg.beginPath(); lg.ellipse(cx - 1, cy, s * 0.7, s * 0.28, 0, 0, 7); lg.stroke(); lg.beginPath(); lg.moveTo(cx + s * 0.6, cy); lg.lineTo(cx + s, cy - s * 0.3); lg.lineTo(cx + s, cy + s * 0.3); lg.closePath(); lg.stroke(); lg.fillRect(cx - s * 0.5, cy - 1, 1.5, 1.5); }
  else if (kind === 'shell') { lg.beginPath(); lg.ellipse(cx, cy, s * 0.6, s * 0.4, 0, 0, 7); lg.stroke(); for (let k = -2; k <= 2; k++) { lg.beginPath(); lg.moveTo(cx, cy + s * 0.35); lg.lineTo(cx + k * s * 0.22, cy - s * 0.35); lg.stroke(); } }
  else if (kind === 'cow') { lg.beginPath(); lg.ellipse(cx, cy, s * 0.6, s * 0.3, 0, 0, 7); lg.stroke(); lg.beginPath(); lg.arc(cx + s * 0.7, cy - s * 0.2, s * 0.18, 0, 7); lg.stroke(); for (const dx of [-0.4, -0.2, 0.25, 0.45]) { lg.beginPath(); lg.moveTo(cx + dx * s, cy + s * 0.25); lg.lineTo(cx + dx * s, cy + s * 0.6); lg.stroke(); } }
  else if (kind === 'leaf') { lg.beginPath(); lg.moveTo(cx - s * 0.6, cy + s * 0.3); lg.quadraticCurveTo(cx, cy - s * 0.9, cx + s * 0.6, cy - s * 0.3); lg.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.6, cy + s * 0.3); lg.stroke(); lg.beginPath(); lg.moveTo(cx - s * 0.5, cy + s * 0.2); lg.lineTo(cx + s * 0.5, cy - s * 0.25); lg.stroke(); }
  else if (kind === 'dots') { for (let k = 0; k < 7; k++) { lg.beginPath(); lg.ellipse(cx - s * 0.5 + (k % 4) * s * 0.33, cy - s * 0.15 + Math.floor(k / 4) * s * 0.35, s * 0.13, s * 0.18, 0.3, 0, 7); lg.stroke(); } }
  else if (kind === 'bean') { lg.beginPath(); lg.ellipse(cx, cy, s * 0.55, s * 0.38, 0.4, 0, 7); lg.stroke(); lg.beginPath(); lg.moveTo(cx - s * 0.35, cy + s * 0.2); lg.quadraticCurveTo(cx, cy, cx + s * 0.35, cy - s * 0.2); lg.stroke(); }
  else { lg.strokeRect(cx - s * 0.4, cy - s * 0.45, s * 0.8, s * 0.9); lg.beginPath(); lg.moveTo(cx - s * 0.4, cy - s * 0.15); lg.lineTo(cx + s * 0.4, cy - s * 0.15); lg.stroke(); }
}
function agedPaper(g, r, seed, base = PAPER) {
  pixels(g, r, (u, v, x, y) => { const e = Math.min(u, 1 - u, v, 1 - v), l = 0.93 + 0.08 * (fbm(u, v, 4, 2, 3, seed) - 0.5) - 0.1 * (1 - smoothstep(0, 0.12, e)) - 0.06 * hash(x >> 1, y >> 1, seed); return [base[0] * l, base[1] * l * 0.99, base[2] * l * 0.95]; });
}
function tinLabels(g, A) {
  A.tins.forEach((r, i) => {
    // (half of them printed the other way about: the ink as the ground, the lettering and the picture in the paper's cream)
    const [name, inkName, pic] = TINS[i], dark = i % 2 === 1, ground = INKS[inkName], ink = dark ? PAPER : ground, [x0, y0, w, h] = r, cx = w / 2;
    if (dark) pixels(g, r, (u, v, x, y) => { const l = 0.92 + 0.1 * (fbm(u, v, 4, 2, 3, 2100 + i) - 0.5) - 0.05 * hash(x >> 1, y >> 1, 2100 + i); return ground.map((q) => q * l); });
    else agedPaper(g, r, 2100 + i);
    const L = canvasOf(w, h), lg = L.getContext('2d');
    // (a band of the ink top and bottom with a fine rule inside it; the oval vignette; the name; small print round the back)
    lg.fillStyle = `rgb(${ink})`; lg.fillRect(0, 0, w, 7); lg.fillRect(0, h - 7, w, 7);
    lg.fillStyle = `rgba(${ink},0.8)`; lg.fillRect(0, 9, w, 1); lg.fillRect(0, h - 10, w, 1);
    lg.strokeStyle = `rgb(${ink})`; lg.lineWidth = 1.2; lg.beginPath(); lg.ellipse(cx, h * 0.38, 13, 9, 0, 0, 7); lg.stroke();
    engraving(lg, pic, cx, h * 0.38, 8, dark ? PAPER : [52, 40, 30]);
    lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillStyle = `rgb(${ink})`;
    const words = name.split(' ');
    if (words.length > 1) { fitText(lg, words[0], cx, h * 0.64, 60, 9, SLAB(800)); fitText(lg, words.slice(1).join(' '), cx, h * 0.77, 60, 9, SLAB(800)); }
    else fitText(lg, name, cx, h * 0.7, 60, i % 3 === 0 ? 13 : 12, i % 3 === 0 ? RYE : SLAB(800));
    lg.fillStyle = dark ? 'rgba(222,208,174,0.7)' : 'rgba(52,40,30,0.7)'; lg.font = '600 6px Bitter, Georgia, serif'; for (const sx of [cx + 44, cx - 44]) { lg.fillText('FINEST', sx, h * 0.45); lg.fillText('QUALITY', sx, h * 0.57); }
    wear(lg, [0, 0, w, h], 0.03, 2150 + i, 3);
    g.drawImage(L, x0, y0);
  });
}
const BOXES = [['SOAP', 'ochre', 'paper'], ['SODA CRACKERS', 'indigo', 'paper'], ['MATCHES', 'oxblood', 'ink'], ['TEA', 'olive', 'ink'],
  ['OATS', 'oxblood', 'paper'], ['STARCH', 'indigo', 'ink'], ['BAKING SODA', 'umber', 'paper'], ['CANDLES', 'slate', 'paper']];
function boxLabels(g, A) {
  A.boxes.forEach((r, i) => {
    const [name, inkName, ground] = BOXES[i], ink = INKS[inkName], [x0, y0, w, h] = r;
    if (ground === 'ink') pixels(g, r, (u, v) => { const l = 0.9 + 0.12 * (fbm(u, v, 3, 3, 2, 2200 + i) - 0.5); return ink.map((q) => q * l); });
    else agedPaper(g, r, 2200 + i);
    const fg = ground === 'ink' ? PAPER : ink, L = canvasOf(w, h), lg = L.getContext('2d');
    lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillStyle = lg.strokeStyle = `rgb(${fg})`;
    lg.lineWidth = 2; lg.strokeRect(9, 9, w - 18, h - 18); lg.lineWidth = 1; lg.strokeRect(13, 13, w - 26, h - 26);
    const words = name.split(' ');
    words.forEach((t, k) => fitText(lg, t, w / 2, h * (words.length > 1 ? 0.36 + k * 0.24 : 0.46), w * 0.7, 24, k === 0 && i % 2 ? RYE : SLAB(800)));
    lg.font = '600 9px Bitter, Georgia, serif'; lg.fillText('— PURE —', w / 2, h * 0.8);
    wear(lg, [0, 0, w, h], 0.04, 2250 + i, 3);
    g.drawImage(L, x0, y0);
  });
}
// fade a region toward its own grey-cream (old print and sun): amount 0..1
function mute(g, [x0, y0, w, h], amount) {
  const img = g.getImageData(x0, y0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] += (l * 1.06 - d[i]) * amount; d[i + 1] += (l * 1.0 - d[i + 1]) * amount; d[i + 2] += (l * 0.86 - d[i + 2]) * amount; }
  g.putImageData(img, x0, y0);
}
// the register's keys: three rows of round white-rimmed keys with numbers on a black plate, a row of tall amount keys
function registerKeys(g, [x0, y0, w, h]) {
  g.fillStyle = '#1e1a16'; g.fillRect(x0, y0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
    const cx = x0 + 10 + c * 17.5, cy = y0 + 12 + r * 19;
    g.fillStyle = '#8a7240'; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
    g.fillStyle = '#d8d0bc'; g.beginPath(); g.arc(cx, cy, 5.4, 0, 7); g.fill();
    g.fillStyle = '#2a2420'; g.font = '700 6px Bitter, Georgia, serif'; g.fillText(String((c + 1) * (r === 0 ? 1 : r === 1 ? 10 : 100) % 1000), cx, cy + 0.5);
  }
}
function tiles(g, A) {
  const T = A.tile, n = (u, v, s, k = 4) => fbm(u, v, k, k, 3, s);
  // (galvanized zinc, gone dull: a grey mottled with the crystal spangle, darker blotches where it has oxidized)
  pixels(g, T.tin, (u, v, x, y) => { const sp = 0.92 + 0.12 * hash(Math.floor(x / 7 + 2.5 * fbm(u, v, 3, 3, 2, 2301)), Math.floor(y / 7 + 2.5 * fbm(u, v, 3, 3, 2, 2305)), 2302), l = (0.62 + 0.14 * n(u, v, 2303, 3)) * sp - 0.08 * smoothstep(0.55, 0.8, n(u, v, 2304, 2)); return [150 * l, 152 * l, 150 * l]; });
  pixels(g, T.darkwood, (u, v, x, y) => { const l = 0.8 + 0.2 * Math.sin(y * 0.5 + n(u, v, 2303, 2) * 8) * 0.4 + 0.15 * n(u, v, 2305); return [92 * l, 62 * l, 40 * l]; });
  pixels(g, T.leather, (u, v) => { const l = 0.8 + 0.3 * n(u, v, 2307, 6); return [112 * l, 66 * l, 38 * l]; });
  pixels(g, T.leatherBlack, (u, v) => { const l = 0.8 + 0.3 * n(u, v, 2309, 6); return [40 * l, 33 * l, 28 * l]; });
  pixels(g, T.brass, (u, v) => { const l = 0.75 + 0.35 * n(u, v, 2311, 3); return [214 * l, 168 * l, 74 * l]; });
  pixels(g, T.enamel, (u, v) => { const l = 0.9 + 0.1 * n(u, v, 2313); return [228 * l, 230 * l, 226 * l]; });
  pixels(g, T.castIron, (u, v) => { const l = 0.7 + 0.4 * n(u, v, 2315, 8); return [56 * l, 54 * l, 54 * l]; });
  // (stoneware: a crock's cream-grey salt glaze, a cobalt band near its shoulder, specks in the glaze)
  pixels(g, T.glass, (u, v, x, y) => { const l = 0.88 + 0.1 * n(u, v, 2317) - 0.15 * Math.pow(hash(x, y, 2318), 12); const band = Math.abs(v - 0.28) < 0.05 || Math.abs(v - 0.38) < 0.015; return band ? [70 * l, 82 * l, 118 * l] : [196 * l, 188 * l, 168 * l]; });
  pixels(g, T.candy, (u, v, x, y) => { const s = ((x + y * 0.7) % 12) < 5; return s ? [204, 40, 40] : [244, 238, 228]; });
  pixels(g, T.cotton, weave([198, 180, 144], 2319, 2, 0.12));
  pixels(g, T.kraft, (u, v) => { const l = 0.88 + 0.16 * n(u, v, 2321, 6); return [176 * l, 140 * l, 96 * l]; });
  pixels(g, T.wax, (u, v) => { const l = 0.85 + 0.2 * n(u, v, 2323); return [220 * l, 180 * l, 60 * l]; });
  // (an apple's skin: a dull red flushed over yellow-green, faint streaks down it)
  pixels(g, T.felt, (u, v, x) => { const f = smoothstep(0.25, 0.75, n(u, v, 2325, 2) + 0.25 * Math.sin(u * 12.6)), l = 0.85 + 0.15 * n(u, v, 2326, 8); return [(120 + 30 * (1 - f)) * l, (34 + 90 * (1 - f)) * l, (28 + 20 * (1 - f)) * l]; });
  pixels(g, T.rope, (u, v, x, y) => { const t = ((x + y) % 10) / 10, l = 0.55 + 0.45 * Math.sin(t * Math.PI); return [190 * l, 160 * l, 110 * l]; });
  pixels(g, T.crate, (u, v, x, y) => { const l = 0.86 + 0.1 * Math.sin(y * 0.3 + n(u, v, 2327, 2) * 6) * 0.5 + 0.14 * n(u, v, 2329); return [196 * l, 160 * l, 112 * l]; });
  pixels(g, T.coal, (u, v, x, y) => { const l = 0.3 + 0.5 * Math.pow(hash(x >> 2, y >> 2, 2331), 3); return [40 * l, 40 * l, 44 * l]; });
}
// heaps seen from above: round things packed together, each shaded as a little ball lit from the upper left
function heap(g, r, seed, n, rad, col, o = {}) {
  const [x0, y0, w, h] = r, R = rng(seed), L = canvasOf(w, h), lg = L.getContext('2d');
  lg.fillStyle = o.under || 'rgb(40,30,22)'; lg.fillRect(0, 0, w, h);
  for (let k = 0; k < n; k++) {
    const x = R() * w, y = R() * h, rr = rad * (0.8 + 0.4 * R()), c = col(R, k);
    if (o.square) {
      lg.save(); lg.translate(x, y); lg.rotate(R() * 3); lg.fillStyle = `rgb(${c.map((q) => q * 0.7 | 0)})`; lg.fillRect(-rr, -rr, rr * 2, rr * 2); lg.fillStyle = `rgb(${c})`; lg.fillRect(-rr + 1, -rr + 1, rr * 2 - 3, rr * 2 - 3);
      lg.fillStyle = 'rgba(120,90,50,0.5)'; for (const [dx, dy] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { lg.beginPath(); lg.arc(dx * rr, dy * rr, 0.9, 0, 7); lg.fill(); }
      lg.restore(); continue;
    }
    const gr = lg.createRadialGradient(x - rr * 0.35, y - rr * 0.35, rr * 0.1, x, y, rr);
    gr.addColorStop(0, `rgb(${c.map((q) => Math.min(255, q * 1.35) | 0)})`); gr.addColorStop(0.7, `rgb(${c})`); gr.addColorStop(1, `rgb(${c.map((q) => q * 0.45 | 0)})`);
    lg.fillStyle = gr; lg.beginPath(); if (o.long) lg.ellipse(x, y, rr * 2.4, rr * 0.5, R() * 3, 0, 7); else lg.ellipse(x, y, rr, rr * (o.oval || 1), R() * 3, 0, 7); lg.fill();
    if (o.mint) { lg.strokeStyle = 'rgba(200,30,30,0.9)'; lg.lineWidth = 1.6; for (let s = 0; s < 3; s++) { lg.beginPath(); lg.arc(x, y, rr * 0.6, s * 2.1, s * 2.1 + 1); lg.stroke(); } }
    if (o.stem) { lg.fillStyle = 'rgb(60,40,20)'; lg.fillRect(x - 0.6, y - 1, 1.4, 2.4); }
  }
  g.drawImage(L, x0, y0);
}
function heaps(g, A) {
  const H = A.heaps;
  heap(g, H.apples, 2401, 120, 9, (R) => (R() < 0.75 ? [128 + R() * 30, 34 + R() * 22, 26] : [140, 132, 58]), { stem: true });
  heap(g, H.crackers, 2403, 110, 8, (R) => [222 + R() * 20, 196 + R() * 20, 140], { square: true, under: 'rgb(150,120,80)' });
  heap(g, H.drops, 2405, 300, 4.5, (R) => [[176, 60, 50], [206, 170, 80], [104, 140, 84], [196, 136, 140], [226, 220, 204], [120, 96, 140]][Math.floor(R() * 6)]);
  // (small hard candy for the jars: drops and humbugs a few millimetres across, the colours of old boiled sweets)
  heap(g, A.candy, 2417, 700, 2.4, (R) => [[170, 56, 46], [204, 168, 78], [110, 140, 86], [200, 140, 142], [228, 222, 206], [148, 92, 56]][Math.floor(R() * 6)], { under: 'rgb(90,60,44)' });
  heap(g, H.beans, 2407, 520, 3.2, (R) => [80 + R() * 30, 46 + R() * 16, 26], { oval: 0.7, under: 'rgb(30,20,14)' });
  heap(g, H.potatoes, 2409, 60, 13, (R) => [170 + R() * 20, 130 + R() * 20, 80], { oval: 0.75 });
  heap(g, H.nails, 2411, 260, 3, (R) => [120 + R() * 30, 116 + R() * 30, 112], { long: true, under: 'rgb(60,56,52)' });
  heap(g, H.mints, 2413, 140, 6.5, () => [244, 240, 234], { mint: true, under: 'rgb(200,190,180)' });
  heap(g, H.pickles, 2415, 70, 7, (R) => [80 + R() * 30, 110 + R() * 30, 40], { oval: 0.5, under: 'rgb(110,120,60)' });
}
// the price board behind the counter: slate in a wooden frame, prices in chalk (for a game about sums)
function priceBoard(g, r) {
  const [x0, y0, w, h] = r, R = rng(2501);
  g.fillStyle = '#5a4128'; g.fillRect(x0, y0, w, h); g.fillStyle = '#28302c'; g.fillRect(x0 + 10, y0 + 10, w - 20, h - 20);
  for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(220,226,214,${0.02 + R() * 0.05})`; g.beginPath(); g.ellipse(x0 + 20 + R() * (w - 40), y0 + 20 + R() * (h - 40), 12 + R() * 34, 5 + R() * 12, R() * 3, 0, 7); g.fill(); }
  const L = canvasOf(w, h), lg = L.getContext('2d'); lg.fillStyle = lg.strokeStyle = '#f0f1e8'; lg.textBaseline = 'middle';
  lg.textAlign = 'center'; lg.lineWidth = 1.5; lg.font = RYE(30); lg.fillText("TODAY'S PRICES", w / 2, 36); lg.strokeText("TODAY'S PRICES", w / 2, 36);
  const rows = [['FLOUR', '4¢ lb'], ['SUGAR', '9¢ lb'], ['COFFEE', '25¢ lb'], ['EGGS', '12¢ doz'], ['NAILS', '5¢ lb'], ['CANDY', '1¢ ea']];
  lg.font = SLAB(800)(19);
  rows.forEach(([a, b], i) => { const y = 70 + i * 24; lg.textAlign = 'left'; lg.fillText(a, 30, y); lg.textAlign = 'right'; lg.fillText(b, w - 30, y); lg.fillStyle = 'rgba(240,241,232,0.5)'; lg.fillRect(130, y + 2, w - 240, 1.5); lg.fillStyle = '#f0f1e8'; });
  wear(lg, [0, 0, w, h], 0.12, 2503, 3);
  g.drawImage(L, x0, y0);
}
function storePosters(g, A) {
  const p2 = A.posters[1];
  paper(g, p2, 2611, { base: [226, 220, 190], folds: 1 });
  onPaper(g, p2, (pg, w, h) => {
    pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillStyle = '#2f5a2a'; fitText(pg, 'GARDEN', w / 2, h * 0.12, w * 0.8, 28, RYE); fitText(pg, 'SEEDS', w / 2, h * 0.25, w * 0.8, 30, RYE);
    // a carrot, a beet and a pea pod
    pg.fillStyle = '#e07a2a'; pg.beginPath(); pg.moveTo(w * 0.3, h * 0.36); pg.lineTo(w * 0.42, h * 0.36); pg.lineTo(w * 0.36, h * 0.66); pg.fill();
    pg.fillStyle = '#4a8a3a'; pg.fillRect(w * 0.33, h * 0.31, w * 0.06, h * 0.05);
    pg.fillStyle = '#8a2040'; pg.beginPath(); pg.arc(w * 0.62, h * 0.5, w * 0.11, 0, 7); pg.fill(); pg.fillStyle = '#4a8a3a'; pg.fillRect(w * 0.6, h * 0.35, w * 0.04, h * 0.06);
    pg.fillStyle = '#6aa04a'; pg.beginPath(); pg.ellipse(w * 0.5, h * 0.7, w * 0.2, h * 0.03, -0.2, 0, 7); pg.fill();
    pg.fillStyle = INK; fitText(pg, '5¢ A PACKET', w / 2, h * 0.82, w * 0.8, 16, SLAB(800));
    printLines(pg, w * 0.16, h * 0.88, w * 0.68, 2, rng(2613), 7);
  });
}
function storePictures(g, A) {
  const [a, b] = A.pictures;
  // a sepia print of a horse, in a dark frame; a mountain scene
  for (const [r, kind] of [[a, 'horse'], [b, 'hills']]) {
    const [x0, y0, w, h] = r;
    g.fillStyle = '#3a2a1c'; g.fillRect(x0, y0, w, h); g.fillStyle = '#c9a66a'; g.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
    pixels(g, [x0 + 10, y0 + 10, w - 20, h - 20], (u, v) => { const l = 0.8 + 0.25 * (fbm(u, v, 4, 3, 3, 2701) - 0.5); return kind === 'horse' ? [220 * l, 200 * l, 160 * l] : [180 * l, 200 * l, 214 * l]; });
    g.save(); g.beginPath(); g.rect(x0 + 10, y0 + 10, w - 20, h - 20); g.clip();
    if (kind === 'horse') {
      g.fillStyle = 'rgba(70,46,26,0.9)'; const cx = x0 + w / 2, cy = y0 + h * 0.56;
      g.beginPath(); g.ellipse(cx, cy, 26, 11, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx + 20, cy - 4); g.lineTo(cx + 34, cy - 22); g.lineTo(cx + 42, cy - 18); g.lineTo(cx + 28, cy + 2); g.fill();
      for (const dx of [-20, -12, 14, 22]) g.fillRect(cx + dx, cy + 6, 3, 20);
      g.fillRect(x0 + 10, y0 + h * 0.8, w - 20, 2);
    } else {
      g.fillStyle = 'rgba(80,96,110,0.9)'; g.beginPath(); g.moveTo(x0 + 10, y0 + h * 0.7); g.lineTo(x0 + w * 0.35, y0 + h * 0.25); g.lineTo(x0 + w * 0.55, y0 + h * 0.5); g.lineTo(x0 + w * 0.75, y0 + h * 0.3); g.lineTo(x0 + w - 10, y0 + h * 0.65); g.lineTo(x0 + w - 10, y0 + h - 10); g.lineTo(x0 + 10, y0 + h - 10); g.fill();
      g.fillStyle = 'rgba(240,244,246,0.9)'; g.beginPath(); g.moveTo(x0 + w * 0.35, y0 + h * 0.25); g.lineTo(x0 + w * 0.3, y0 + h * 0.34); g.lineTo(x0 + w * 0.4, y0 + h * 0.33); g.fill();
      g.fillStyle = 'rgba(60,90,50,0.9)'; g.fillRect(x0 + 10, y0 + h * 0.78, w - 20, h * 0.22);
    }
    g.restore();
  }
  // the flag: thirteen stripes, a blue field with rows of white stars, a little faded
  const [fx, fy, fw, fh] = A.flag;
  pixels(g, A.flag, (u, v) => { const l = 0.88 + 0.12 * fbm(u, v, 4, 3, 2, 2711); if (u < 0.42 && v < 0.54) { const sx = (u / 0.42) * 8, sy = (v / 0.54) * 5; const star = Math.hypot(sx - Math.floor(sx) - 0.5, sy - Math.floor(sy) - 0.5) < 0.2; return star ? [236 * l, 232 * l, 220 * l] : [44 * l, 54 * l, 104 * l]; } return (Math.floor(v * 13) % 2 ? [236, 228, 214] : [170, 44, 40]).map((q) => q * l); });
  // the checkerboard: dark red and black squares in a wooden border
  const [cx, cy, cw] = A.checker;
  pixels(g, A.checker, (u, v, x, y) => { const b = 8; if (x < b || y < b || x >= cw - b || y >= cw - b) return [120, 82, 50]; const i = Math.floor((x - b) / ((cw - 2 * b) / 8)), j = Math.floor((y - b) / ((cw - 2 * b) / 8)); const l = 0.9 + 0.1 * hash(i, j, 2721); return ((i + j) & 1 ? [30, 26, 24] : [170, 40, 34]).map((q) => q * l); });
}
const LABELS = ['COFFEE', 'TEA', 'RICE', 'BEANS', 'SPICE', 'OATS', 'SALT', 'SODA', 'NUTMEG', 'CLOVES', 'PEPPER', 'GINGER', 'BARLEY', 'BUTTONS', 'THREAD', 'CANDLES'];
function drawerLabels(g, A) {
  A.labels.forEach((r, i) => {
    const [x0, y0, w, h] = r; g.clearRect(x0, y0, w, h);
    // a brass card frame round a cream card, the word in black
    g.fillStyle = '#b08a3c'; g.fillRect(x0 + 6, y0 + 10, w - 12, h - 20); g.fillStyle = '#e9e0c4'; g.fillRect(x0 + 9, y0 + 13, w - 18, h - 26);
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, LABELS[i], x0 + w / 2, y0 + h / 2 + 1, w - 22, 12, SLAB(800));
    g.fillStyle = '#6e5420'; g.beginPath(); g.arc(x0 + w / 2, y0 + h - 5, 3, 0, 7); g.fill();
  });
  for (const [t, r] of Object.entries(A.stencils)) {
    const [x0, y0, w, h] = r; g.clearRect(x0, y0, w, h);
    const L = canvasOf(w, h), lg = L.getContext('2d'); lg.fillStyle = 'rgba(30,24,20,0.9)'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
    fitText(lg, t, w / 2, h / 2 + 2, w - 16, 34, SLAB(900)); wear(lg, [0, 0, w, h], 0.22, 2801 + w, 2.2);
    g.drawImage(L, x0, y0);
  }
  // books: spines of every colour, gilt bands across them
  const [bx, by, bw, bh] = A.books, R = rng(2811);
  for (let x = 0; x < bw;) { const ww = 9 + Math.floor(R() * 9), c = [[110, 30, 26], [40, 60, 90], [50, 80, 50], [90, 60, 30], [30, 30, 32], [120, 90, 50]][Math.floor(R() * 6)], tall = bh * (0.72 + 0.28 * R());
    g.fillStyle = 'rgb(30,22,16)'; g.fillRect(bx + x, by, ww, bh); g.fillStyle = `rgb(${c})`; g.fillRect(bx + x + 1, by + bh - tall, ww - 1, tall);
    g.fillStyle = 'rgba(214,176,90,0.9)'; for (const f of [0.12, 0.2, 0.82]) g.fillRect(bx + x + 2, by + bh - tall * (1 - f), ww - 3, 2); x += ww; }
  // a keg's side, wrapped once round it: staves (each its own shade, a dark seam between), two dark iron hoops
  pixels(g, A.keg, (u, v, x, y) => { const st = Math.floor(u * 8), f = u * 8 - st, seam = f < 0.08 || f > 0.94, hoop = Math.abs(v - 0.16) < 0.045 || Math.abs(v - 0.84) < 0.045; const l = (0.82 + 0.25 * hash(st, 3, 2901)) * (0.9 + 0.12 * fbm(u, v, 2, 6, 2, 2903)); if (hoop) return [58, 52, 48].map((q) => q * (0.85 + 0.3 * hash(x, y, 2905))); return seam ? [70, 50, 34] : [150 * l, 112 * l, 74 * l]; });
  // the till's brass: fine, low relief (a beaded border, a running scroll of small leaves, a plain oval in the middle),
  // the high spots only a little brighter than the hollows, dulled with handling
  const [ox, oy, ow, oh] = A.ornate;
  pixels(g, A.ornate, (u, v) => { const l = 0.66 + 0.18 * fbm(u, v, 3, 2, 2, 2911) + 0.05 * Math.sin(u * 9 + v * 3); return [176 * l, 140 * l, 66 * l]; });
  const emboss = (draw) => { for (const [dx, dy, col, lw] of [[0.8, 0.8, 'rgba(70,48,18,0.45)', 1.6], [-0.6, -0.6, 'rgba(240,214,140,0.35)', 1.1]]) { g.save(); g.translate(ox + dx, oy + dy); g.strokeStyle = col; g.lineWidth = lw; draw(); g.restore(); } };
  emboss(() => { g.strokeRect(4, 4, ow - 8, oh - 8); g.strokeRect(8, 8, ow - 16, oh - 16);
    for (let x = 12; x < ow - 10; x += 6) { g.beginPath(); g.arc(x, 6, 1.2, 0, 7); g.stroke(); g.beginPath(); g.arc(x, oh - 6, 1.2, 0, 7); g.stroke(); }
    g.beginPath(); g.ellipse(ow / 2, oh / 2, 20, 13, 0, 0, 7); g.stroke();
    for (let k = 0; k < 7; k++) { const x = 18 + k * 18, y = oh / 2 + (k % 2 ? 10 : -10); if (Math.abs(x - ow / 2) < 26) continue; g.beginPath(); g.arc(x, y, 5, 0.3, 4.5); g.stroke(); g.beginPath(); g.ellipse(x + 4, y - (k % 2 ? 5 : -5), 3, 1.5, 0.6, 0, 7); g.stroke(); } });

}
// THE STORE'S SIGN, PAINTED STRAIGHT ONTO THE FALSE FRONT'S BOARDS (as the sheriff's: the board shader lays it on). 1024 x
// 640 for 7.4 x 4.6 m of wall, from 4.3 m up. On the whitewash: "GENERAL STORE" in big dark slab letters, worn back,
// "DRY GOODS · GROCERIES · HARDWARE" smaller under it; the ghost letters of an older sign in faded red showing through
// the whitewash above and below them (and plainer where the whitewash has peeled).
export const STORE_SIGN = { w: 1024, h: 640, m: [7.4, 4.6] };
export function storeSign(layout) {
  const { w, h } = STORE_SIGN, ppm = w / STORE_SIGN.m[0], Y = (y) => h - y * ppm;   // (y: metres up from the sign's foot)
  const mask = (draw) => { const c = canvasOf(w, h), g = c.getContext('2d', { willReadFrequently: true }); draw(g); const d = g.getImageData(0, 0, w, h).data, a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255; return a; };
  const X = (x) => x * ppm;
  // the ghosts: an older sign above (over the middle step) and a line low down between the upper windows
  const ghost = mask((gg) => {
    gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = '#000';
    for (const G of layout.ghosts) { fitText(gg, G.text, X(G.x), Y(G.y), X(G.w), G.size * ppm, G.font === 'rye' ? RYE : SLAB(800)); }
    wear(gg, [0, 0, w, h], 0.3, 3001, 2.2);
  });
  const letters = mask((tg) => {
    tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillStyle = '#000'; tg.strokeStyle = '#000'; tg.lineJoin = 'round';
    const B = layout.big;
    // (the big letters set one by one, a hair apart, each a little off the line: painted by hand)
    let size = B.size * ppm; tg.font = SLAB(900)(size);
    const track = size * 0.04, width = (t) => [...t].reduce((s, c) => s + tg.measureText(c).width, 0) + (t.length - 1) * track;
    while (width(B.text) > X(B.w) && size > 20) { size -= 2; tg.font = SLAB(900)(size); }
    let x = X(B.x) - width(B.text) / 2; tg.textAlign = 'left';
    for (const c of B.text) { const yy = Y(B.y) + Math.sin(x * 0.05) * 2.5; tg.lineWidth = 4; tg.strokeText(c, x, yy); tg.fillText(c, x, yy); x += tg.measureText(c).width + track; }
    tg.textAlign = 'center';
    const S = layout.small; fitText(tg, S.text, X(S.x), Y(S.y), X(S.w), S.size * ppm, SLAB(800), { stroke: 1.5 });
    wear(tg, [0, 0, w, h], 0.14, 3011, 1.6);
    const R = rng(3021);
    for (let k = 0; k < 10; k++) tg.fillRect(X(B.x - B.w / 2) + X(B.w) * R(), Y(B.y) + size * 0.36, 3, 6 + R() * 18);
  });
  const RED = [150, 66, 50], INKC = [34, 26, 22];
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, gA = 0.68 * ghost[i], lA = letters[i];
    let A = gA, Cr = RED[0] * gA, Cg = RED[1] * gA, Cb = RED[2] * gA;
    Cr = INKC[0] * lA + Cr * (1 - lA); Cg = INKC[1] * lA + Cg * (1 - lA); Cb = INKC[2] * lA + Cb * (1 - lA); A = lA + A * (1 - lA);
    const o = ((h - 1 - y) * w + x) * 4;
    if (A > 0.004) { data[o] = Cr / A; data[o + 1] = Cg / A; data[o + 2] = Cb / A; } else { data[o] = INKC[0]; data[o + 1] = INKC[1]; data[o + 2] = INKC[2]; }
    data[o + 3] = Math.round(255 * Math.min(1, A));
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
export async function makeStoreArt(signLayout) {
  try { await Promise.all([document.fonts.load('64px Rye'), document.fonts.load('900 64px Bitter'), document.fonts.load('800 40px Bitter'), document.fonts.load('700 16px Bitter')]); } catch (e) { /* the fonts are optional */ }
  const t0 = performance.now(), A = STORE_ART, c = canvasOf(A.w, A.h), g = c.getContext('2d', { willReadFrequently: true });
  sackPrints(g, A); clothPatterns(g, A); tinLabels(g, A); boxLabels(g, A); tiles(g, A); heaps(g, A);
  priceBoard(g, A.board); storePosters(g, A); storePictures(g, A); drawerLabels(g, A); registerKeys(g, A.keys);
  // (everything printed faded toward the paper's own grey-cream: labels, sacks' prints, cloth, posters, pictures)
  for (const r of [[0, 256, 1024, 256], A.flour, A.coffee, ...A.cloth, A.posters[1], ...A.pictures, A.flag]) mute(g, r, 0.35);
  const t = tex(c, { repeat: false, aniso: 8 });
  const signPaint = storeSign(signLayout);
  return { store: t, signPaint, bytes: gpuBytes(A.w, A.h) + gpuBytes(STORE_SIGN.w, STORE_SIGN.h), ms: performance.now() - t0 };
}
