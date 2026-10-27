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
