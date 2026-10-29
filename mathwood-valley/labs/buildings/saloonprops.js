// THE SALOON'S OWN PROPS AND PICTURE (the saloon itself: saloon.js). A shared props library will take these in later
// (~/pw/bandit-math/PROPS.md); until then they live here and join props.js's makers when this file is loaded, so the
// lab's buildProps builds them like any other prop.
//
// THE PICTURE (SALOON_ART, 1024 x 1024, drawn in code at load): everything in the saloon that is painted, printed,
// pasted, woven or poured, laid on the building as decals (see-through round their edges) or wrapped round goods
// (goods.js: opaque):
//   sign       "SALOON" in big cream slab letters, worn back to the wall in flakes (laid board by board on the false
//              fronts, saloon.js signStrips)
//   gold       "SALOON" in gold leaf with a dark line round it and a flourish under it, for the display windows' glass
//   lace       a lace curtain: net, flowers, a scalloped hem; mostly see-through
//   velvet     red velvet in vertical folds (it tiles across), for the stage's drapes and the valance
//   fringe     a gold braid with a fringe hanging from it (the valance's edge)
//   paper      red damask wallpaper, one metre to a repeat (it tiles both ways)
//   chalk      the teacher's chalkboard: a hand-drawn bar graph and a line graph, smudges where it was wiped
//   bottles    three rows of bottles (sarsaparilla, root beer, cream soda, ginger beer, lemon syrup) on see-through:
//              each shelf's bottles are one quad of this, not a mesh per bottle
//   mirror     the back bar's mirror: a dim, warm, blurred room in old silvering
//   pictures   three framed pictures (a horse at sunset, mountains and a lake, a lady in an oval)
//   poster     the band's poster ("TONIGHT · THE MATHWOOD BAND"), menu: the drinks board (sarsaparilla 5¢ ...)
//   keys, music, tiles   a piano's keyboard, a sheet of music, plain brass, leather, lacquer, felt, ivory, tin
//
// THE PROPS (each { type, x, y, z, rot, ... } in a building's list; props.js builds them):
//   roundTable   a round pedestal table (r): a top, a turned column, four feet
//   spindleChair a spindle-back chair: four splayed legs, a round seat, two back posts, a bent top rail, spindles
//   barStool     a tall stool: four legs with a footring, a round leather-topped seat
//   piano        an upright piano (its keys facing +z): the case, the lid, the key bed with its keys (the picture's
//                keyboard), a music desk with a sheet on it, carved cheeks and legs, brass candle arms, pedals
//   pianoStool   the round piano stool on four legs
// and from props.js: barrel, keg, bench, hitchrail, trough, crate.

import * as THREE from 'three';
import { T, RX, RY, RZ, mul, vary, ngon } from './parts.js';
import { MAKERS } from './props.js';
import { gpuBytes, regionUV } from './art.js';

// ── the picture ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const SALOON_ART = {
  w: 1024, h: 1024,
  sign: [0, 0, 1024, 192],
  gold: [0, 192, 512, 160], lace: [512, 192, 256, 256], velvet: [768, 192, 256, 256],
  paper: [0, 352, 256, 256], chalk: [256, 448, 384, 256], bottles: [[640, 448, 384, 64], [640, 512, 384, 64], [640, 576, 384, 64]],
  fringe: [0, 608, 256, 48], wainscot: [0, 656, 256, 48],
  mirror: [256, 704, 192, 256], pictures: [[448, 704, 128, 128], [576, 704, 128, 128], [704, 704, 128, 128]],
  poster: [832, 640, 192, 256], menu: [256, 352, 256, 96], rug: [704, 832, 128, 128],
  notice: [0, 704, 128, 160], plates: [[128, 704, 64, 40], [192, 704, 64, 40], [128, 744, 64, 40], [192, 744, 64, 40], [960, 896, 64, 40], [960, 936, 64, 40], [960, 976, 64, 40]],
  keys: [0, 960, 512, 32], music: [512, 960, 64, 64],
  // (the rooms upstairs: a patchwork quilt, a rag rug, bed ticking, their own wallpaper; the street windows' sky)
  quilt: [448, 832, 128, 128], ragrug: [576, 832, 128, 64], ticking: [128, 784, 64, 64], sky: [192, 784, 64, 96], roomPaper: [0, 864, 96, 96],
  tile: Object.fromEntries(['brass', 'leather', 'lacquer', 'felt', 'ivory', 'tin', 'darkwood', 'gold', 'black', 'cream', 'amber', 'glass'].map((k, i) => [k, [576 + (i % 6) * 64, 896 + Math.floor(i / 6) * 64, 64, 64]])),
};

// small helpers: a seeded random, value noise
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, seed, px = 1e9, py = 1e9) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0), m = (v, p) => ((v % p) + p) % p;
  const a = hash(m(x0, px), m(y0, py), seed), b = hash(m(x0 + 1, px), m(y0, py), seed), c = hash(m(x0, px), m(y0 + 1, py), seed), d = hash(m(x0 + 1, px), m(y0 + 1, py), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, oct, seed, px, py) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(x, y, seed + o * 17, px, py); tot += amp; amp *= 0.5; x *= 2; y *= 2; if (px) { px *= 2; py *= 2; } }
  return s / tot;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const SLAB = (s, wt = 900) => `${wt} ${s}px Bitter, Georgia, serif`, RYE = (s) => `400 ${s}px Rye, Georgia, serif`;
// fill a region pixel by pixel: f(u, v, x, y) -> [r, g, b, a?]
function pixels(g, [x0, y0, w, h], f) {
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x / w, y / h, x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255; }
  g.putImageData(img, x0, y0);
}
// draw something into a scratch canvas the size of a region and read back how much of each pixel it covered
function maskOf(w, h, draw) {
  const c = canvasOf(w, h), g = c.getContext('2d', { willReadFrequently: true }); draw(g);
  const d = g.getImageData(0, 0, w, h).data, a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255; return a;
}
// letters set one by one, a hair apart, each a little off the line (painted by hand); fits them to maxW
function handLetters(g, text, cx, cy, maxW, size, font, o = {}) {
  let s = size; g.font = font(s);
  const track = () => s * (o.track ?? 0.06), width = () => [...text].reduce((a, c) => a + g.measureText(c).width, 0) + (text.length - 1) * track();
  while (width() > maxW && s > 8) { s -= 2; g.font = font(s); }
  let x = cx - width() / 2; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (const c of text) {
    const yy = cy + Math.sin(x * 0.045 + (o.ph || 0)) * (o.wob ?? 2);
    if (o.stroke) { g.lineWidth = o.stroke; g.strokeText(c, x, yy); }
    g.fillText(c, x, yy); x += g.measureText(c).width + track();
  }
  return s;
}

// THE SIGN: "SALOON" in cream slab capitals, a thin dark keyline round them, worn: flakes gone back to the wall (crisp
// edged, more toward the bottom of each letter where the rain splashes), the edges a little ragged
function drawSign(g, [x0, y0, w, h]) {
  const letters = maskOf(w, h, (tg) => { tg.fillStyle = '#000'; tg.strokeStyle = '#000'; tg.lineJoin = 'round'; handLetters(tg, 'SALOON', w / 2, h / 2 + 4, w * 0.94, h * 0.92, (s) => SLAB(s, 900), { track: 0.08, stroke: 3, wob: 2.5 }); });
  const keyline = maskOf(w, h, (tg) => { tg.fillStyle = '#000'; tg.strokeStyle = '#000'; tg.lineJoin = 'round'; handLetters(tg, 'SALOON', w / 2, h / 2 + 4, w * 0.94, h * 0.92, (s) => SLAB(s, 900), { track: 0.08, stroke: 11, wob: 2.5 }); });
  const CREAM = [232, 218, 182], LINE = [70, 30, 22];
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    const i = y * w + x, L = letters[i], K = keyline[i] * (1 - L) * 0.55;
    const flake = fbm(u * 26, v * 6, 4, 811) * 0.7 + hash(x >> 1, y >> 1, 813) * 0.3, low = sstep(0.35, 0.95, v);
    const gone = flake < 0.3 + 0.12 * low ? 0 : flake < 0.34 + 0.12 * low ? 0.45 : 1;
    const streak = 0.85 + 0.15 * fbm(u * 3, v * 30, 3, 817);
    const a = Math.max(L * gone * streak, K * gone);
    const c = L > 0.5 ? CREAM.map((q) => q * (0.9 + 0.12 * fbm(u * 40, v * 8, 2, 821))) : LINE;
    return [c[0], c[1], c[2], 255 * clamp01(a)];
  });
}
// THE GOLD LETTERING on the glass: gold leaf shaded top to bottom, a dark outline and a drop shade, a flourish under it
function drawGold(g, [x0, y0, w, h]) {
  g.save(); g.translate(x0, y0); g.clearRect(0, 0, w, h);
  g.fillStyle = '#000'; g.strokeStyle = 'rgba(40,20,8,0.95)'; g.lineJoin = 'round';
  const cy = h * 0.42;
  // (the shade, then the outline, then the gold)
  g.save(); g.translate(4, 4); g.fillStyle = 'rgba(30,14,6,0.8)'; handLetters(g, 'SALOON', w / 2, cy, w * 0.9, h * 0.62, RYE, { track: 0.05, wob: 0.6 }); g.restore();
  handLetters(g, 'SALOON', w / 2, cy, w * 0.9, h * 0.62, RYE, { track: 0.05, stroke: 7, wob: 0.6 });
  const gr = g.createLinearGradient(0, cy - h * 0.3, 0, cy + h * 0.3);
  gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.35, '#e8b84a'); gr.addColorStop(0.55, '#a8701c'); gr.addColorStop(0.8, '#f0c868'); gr.addColorStop(1, '#b07a26');
  g.fillStyle = gr; g.strokeStyle = 'rgba(0,0,0,0)';
  handLetters(g, 'SALOON', w / 2, cy, w * 0.9, h * 0.62, RYE, { track: 0.05, wob: 0.6 });
  // the flourish: a line with a curl at each end and a diamond in the middle
  g.strokeStyle = '#d9a640'; g.lineWidth = 4; g.beginPath();
  g.moveTo(w * 0.2, h * 0.84); g.bezierCurveTo(w * 0.32, h * 0.76, w * 0.42, h * 0.92, w * 0.5, h * 0.84); g.bezierCurveTo(w * 0.58, h * 0.76, w * 0.68, h * 0.92, w * 0.8, h * 0.84); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(w * (0.5 + s * 0.31), h * 0.8, 8, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#e8b84a'; g.beginPath(); g.moveTo(w / 2, h * 0.76); g.lineTo(w / 2 + 12, h * 0.84); g.lineTo(w / 2, h * 0.92); g.lineTo(w / 2 - 12, h * 0.84); g.fill();
  g.restore();
}
// LACE: a fine net, rows of little flowers, a band of bigger ones, a scalloped hem at the foot (v: down the curtain)
function drawLace(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    const hem = 0.86 + 0.05 * Math.abs(Math.sin(u * Math.PI * 8));
    if (v > hem) return [240, 236, 222, 0];
    const nx = (x % 8), ny = (y % 8), net = (nx === 0 || ny === 0) ? 0.8 : 0.4;
    const fx = (x % 32) - 16, fy = (y % 32) - 16, fr = Math.hypot(fx, fy), flower = fr < 6 ? 0.85 * (0.6 + 0.4 * Math.cos(Math.atan2(fy, fx) * 5)) : 0;
    const band = v > 0.62 && v < 0.82 ? (Math.hypot((x % 64) - 32, (y % 64) - 32) < 18 ? 0.5 + 0.4 * Math.cos(Math.hypot((x % 64) - 32, (y % 64) - 32) * 0.7) : 0) : 0;
    const edge = v > hem - 0.03 ? 0.9 : 0;
    const a = Math.min(1, Math.max(net, flower, band, edge)) * (0.85 + 0.15 * hash(x, y, 901));
    return [238, 233, 216, 255 * Math.min(1, a)];
  });
}
// VELVET: deep red, in vertical folds (it tiles across): lighter on each fold's crest, a sheen, nearly black in the
// troughs; a little worn at the foot
function drawVelvet(g, [x0, y0, w, h]) {
  // (a muted burgundy: each fold's trough at 0.45 of its crest, never black; a soft sheen on the crests)
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    const ph = u * Math.PI * 2 * 5 + 0.6 * Math.sin(u * Math.PI * 2 * 2 + v * 2.0);
    const fold = 0.5 + 0.5 * Math.sin(ph), sheen = Math.pow(Math.max(0, Math.sin(ph + 0.5)), 10) * 0.18;
    const nap = 0.94 + 0.06 * hash(x, y >> 1, 931), l = (0.45 + 0.55 * Math.pow(fold, 1.4) + sheen) * nap * (0.9 + 0.1 * vnoise(u * 5, v * 3, 933, 5, 1e9));
    return [Math.min(255, 128 * l + 20 * sheen), Math.min(255, 40 * l + 10 * sheen), Math.min(255, 44 * l + 8 * sheen)];
  });
}
// THE FRINGE: a braided gold band on top, a fringe of threads hanging from it, see-through between them
function drawFringe(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    if (v < 0.3) { const br = 0.6 + 0.4 * Math.abs(Math.sin((x + y * 1.5) * 0.5)); return [210 * br, 160 * br, 60 * br, 255]; }
    const thread = Math.abs(Math.sin(x * Math.PI / 3)) > 0.5, len = 0.85 + 0.15 * hash(x >> 2, 0, 941);
    if (!thread || v > len) return [200, 150, 60, 0];
    const l = 0.6 + 0.4 * hash(x, 1, 943);
    return [200 * l, 145 * l, 55 * l, 255];
  });
}
// DAMASK, FADED: a dusty rose ground, a small damask figure in a slightly deeper rose with a faint ochre line, eight to
// a side of the picture (the picture spans 1.2 m of wall: a figure every 15 cm), low contrast; aged and a little uneven
function drawPaper(g, [x0, y0, w, h]) { drawDamask(g, [x0, y0, w, h], [150, 98, 90], [132, 82, 76], 'rgba(170,140,96,0.32)', 8, 951); }
function drawDamask(g, [x0, y0, w, h], ground, figure, line, n, seed) {
  const c = canvasOf(w, h), cg = c.getContext('2d'), s = w / n;
  cg.fillStyle = `rgb(${ground})`; cg.fillRect(0, 0, w, h);
  const motif = (cx, cy, k) => {
    cg.save(); cg.translate(cx, cy); cg.scale(k, k);
    cg.fillStyle = `rgba(${figure},0.9)`;
    cg.beginPath(); cg.moveTo(0, -12); cg.bezierCurveTo(7, -8, 6, -2, 0, 2); cg.bezierCurveTo(-6, -2, -7, -8, 0, -12); cg.fill();
    cg.beginPath(); cg.moveTo(0, 12); cg.bezierCurveTo(5, 8, 5, 4, 0, 3); cg.bezierCurveTo(-5, 4, -5, 8, 0, 12); cg.fill();
    for (const sx of [-1, 1]) { cg.beginPath(); cg.ellipse(sx * 6.5, 0, 3.6, 1.8, sx * 0.5, 0, Math.PI * 2); cg.fill(); }
    cg.strokeStyle = line; cg.lineWidth = 0.8;
    cg.beginPath(); cg.moveTo(0, -10); cg.bezierCurveTo(4, -7, 4, -2, 0, 0); cg.bezierCurveTo(-4, -2, -4, -7, 0, -10); cg.stroke();
    cg.restore();
  };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { motif(i * s, j * s, s / 32); motif((i + 0.5) * s, (j + 0.5) * s, s / 52); }
  const d = cg.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, nn = 0.9 + 0.12 * fbm(x / w * 4, y / h * 4, 3, seed, 4, 4) + 0.03 * (hash(x, y, seed + 2) - 0.5);
    d.data[i] *= nn; d.data[i + 1] *= nn * 0.99; d.data[i + 2] *= nn * 0.98;
  }
  g.putImageData(d, x0, y0);
}
// THE CHALKBOARD: dark green-black slate with the haze of old wiping, a title, a bar graph (four hatched bars on an axis
// with ticks) and a line graph (dots joined, rising). Chalk, not ink: every stroke is drawn into a mask first, then
// broken up by the slate's grain (gaps, thin spots) and given a soft dust halo
function drawChalk(g, [x0, y0, w, h]) {
  const R = rng(971);
  const strokes = maskOf(w, h, (cg) => {
    cg.strokeStyle = '#000'; cg.fillStyle = '#000'; cg.lineCap = 'round'; cg.lineJoin = 'round';
    const line = (pts, wd = 3.4) => { cg.lineWidth = wd * (0.85 + 0.3 * R()); cg.beginPath(); pts.forEach(([x, y], i) => (i ? cg.lineTo(x + (R() - 0.5) * 1.2, y + (R() - 0.5) * 1.2) : cg.moveTo(x, y))); cg.stroke(); };
    cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.font = RYE(30); cg.fillText('GRAPHS', w / 2, 28);
    const bx = 40, by = h - 36, bw = 150, bh = 150;
    line([[bx, by - bh], [bx, by], [bx + bw, by]]);
    for (let i = 1; i <= 4; i++) line([[bx - 7, by - i * 35], [bx + 2, by - i * 35]], 2.4);
    [0.45, 0.75, 0.6, 0.95].forEach((f, i) => {
      const x = bx + 14 + i * 34, top = by - f * bh;
      line([[x, by], [x, top], [x + 22, top], [x + 22, by]], 3);
      for (let yy = top + 9; yy < by - 3; yy += 10) line([[x + 2, yy + 7], [x + 20, yy]], 1.6);
    });
    const lx = 220, ly = h - 36, lw = 140, lh = 150;
    line([[lx, ly - lh], [lx, ly], [lx + lw, ly]]);
    for (let i = 1; i <= 4; i++) line([[lx - 7, ly - i * 35], [lx + 2, ly - i * 35]], 2.4);
    const pts = [[0.06, 0.2], [0.28, 0.42], [0.5, 0.33], [0.72, 0.68], [0.94, 0.86]].map(([a, b]) => [lx + a * lw, ly - b * lh]);
    line(pts, 3.6);
    for (const [x, y] of pts) { cg.beginPath(); cg.arc(x, y, 5, 0, Math.PI * 2); cg.fill(); }
  });
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    // the slate: dark green-black, a haze of old wiping in broad arcs, a little speckle
    const smudge = fbm(u * 3, v * 2, 4, 961), wipe = sstep(0.5, 0.78, fbm(u * 1.4 + 3, v * 3.2, 3, 963)) * (0.5 + 0.5 * Math.sin(u * 22 + v * 6));
    const sl = 0.92 + 0.2 * smudge + 0.32 * wipe + 0.05 * (hash(x, y, 965) - 0.5);
    let r = 30 * sl, gg = 41 * sl, b = 37 * sl;
    // the chalk: the stroke mask broken by the grain (a coarse tooth and a fine one), and a dust halo round it
    const m = strokes[y * w + x], halo = Math.max(0, (strokes[y * w + Math.max(0, x - 2)] + strokes[y * w + Math.min(w - 1, x + 2)] + strokes[Math.max(0, y - 2) * w + x] + strokes[Math.min(h - 1, y + 2) * w + x]) / 4 - m);
    const tooth = hash(x, y, 967), coarse = vnoise(x / 3, y / 3, 969), a = m * (0.35 + 0.65 * sstep(0.18, 0.6, tooth * 0.55 + coarse * 0.6)) + halo * 0.18;
    r += (226 - r) * a; gg += (230 - gg) * a; b += (218 - b) * a;
    return [r, gg, b];
  });
}
// BOTTLES on a shelf: one row of bottles side by side (see-through between them): amber and brown root beer, dark
// green sarsaparilla, clear cream soda, a blue one, stone ginger beer jugs; labels, a highlight down each
function drawBottles(g, [x0, y0, w, h], seed) {
  g.save(); g.translate(x0, y0); g.clearRect(0, 0, w, h);
  const R = rng(seed), GLASS = [[112, 58, 22], [72, 40, 18], [58, 34, 16], [44, 74, 46], [150, 170, 160], [96, 62, 30], [52, 66, 92]];
  const LABELS = [[212, 198, 162], [150, 70, 50], [200, 186, 150], [178, 148, 86], [122, 104, 80]];
  let x = 2;
  while (x < w - 14) {
    const kind = R(), bw = kind < 0.12 ? 26 : 16 + R() * 6, tall = kind < 0.12 ? 40 : 48 + R() * 14, top = h - tall;
    const col = kind < 0.12 ? [200, 186, 160] : GLASS[Math.floor(R() * GLASS.length)], clear = col[0] > 180 && kind >= 0.12;
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${clear ? 0.7 : 0.97})`;
    const neck = kind < 0.12 ? bw * 0.3 : bw * 0.32, sh = top + tall * (kind < 0.12 ? 0.25 : 0.42);
    // body, shoulder, neck, lip
    g.beginPath(); g.moveTo(x, h); g.lineTo(x, sh); g.quadraticCurveTo(x, sh - 8, x + bw / 2 - neck / 2, sh - 12); g.lineTo(x + bw / 2 - neck / 2, top + 4);
    g.lineTo(x + bw / 2 + neck / 2, top + 4); g.lineTo(x + bw / 2 + neck / 2, sh - 12); g.quadraticCurveTo(x + bw, sh - 8, x + bw, sh); g.lineTo(x + bw, h); g.fill();
    g.fillStyle = kind < 0.12 ? 'rgb(120,80,50)' : 'rgb(200,170,90)'; g.fillRect(x + bw / 2 - neck / 2 - 1, top, neck + 2, 5);
    // the label
    const lab = LABELS[Math.floor(R() * LABELS.length)];
    if (kind < 0.12) { g.fillStyle = 'rgb(90,60,40)'; g.fillRect(x + 3, sh + 6, bw - 6, 8); }
    else { g.fillStyle = `rgb(${lab[0]},${lab[1]},${lab[2]})`; g.fillRect(x + 2, sh + 6, bw - 4, Math.min(18, h - sh - 10)); g.fillStyle = 'rgba(60,30,20,0.7)'; g.fillRect(x + 4, sh + 11, bw - 8, 2); g.fillRect(x + 5, sh + 16, bw - 10, 1.5); }
    // a highlight down its left
    g.fillStyle = 'rgba(255,240,210,0.22)'; g.fillRect(x + 3, sh, 2, h - sh - 4);
    x += bw + 1 + R() * 4;
  }
  g.restore();
}
// THE MIRROR: old silvering showing a dim warm room: dark at the foot, warm smudges of lamplight, the line of a shelf,
// the silver gone grey-black in spots round the edge
// THE MIRROR: old silvering, cool and dim: a soft grey gradient (lighter where it catches the room's light), the
// blurred shapes of the room in it (the lamps as warm smudges, the dark band of the bar), faint streaks in the glass, the
// silver gone in grey-black flecks round the edges and a brighter sheen across one corner
function drawMirror(g, [x0, y0, w, h]) {
  // (old glass: the room dim in it, lighter toward the top, two lamps' glow; its silvering gone a little grey-brown and
  // soft toward the edges, never black holes)
  const blobs = [[0.22, 0.3, 0.07, 0.75], [0.72, 0.24, 0.06, 0.65], [0.5, 0.5, 0.12, 0.25]];
  pixels(g, [x0, y0, w, h], (u, v) => {
    let l = 0.3 + 0.36 * Math.pow(1 - v, 1.4) + 0.06 * fbm(u * 2, v * 3, 3, 977);
    let r = 146 * l, gg = 152 * l, b = 150 * l;
    for (const [bu, bv, sz, k0] of blobs) { const d = Math.hypot((u - bu) * 1.3, v - bv) / sz, k = Math.exp(-d * d) * k0; r += 130 * k; gg += 92 * k; b += 40 * k; }
    if (v > 0.68) { const f = 0.72 - 0.1 * sstep(0.68, 1, v); r *= f; gg *= f; b *= f; }      // (the bar's dark band)
    const sheen = sstep(0.22, 0.0, Math.abs(u - v * 0.7 - 0.05)) * 0.16 + sstep(0.06, 0.0, Math.abs(u - v * 0.7 - 0.32)) * 0.07;
    const edge = Math.min(u, 1 - u, v, 1 - v), wear = sstep(0.62, 0.95, fbm(u * 6, v * 6, 3, 981) + 0.3 * sstep(0.12, 0.0, edge)) * 0.1;
    const f = 1 - wear;
    return [Math.min(255, (r + 255 * sheen) * f + 18 * wear), Math.min(255, (gg + 255 * sheen) * f + 8 * wear), Math.min(255, (b + 250 * sheen) * f)];
  });
}
// THREE PICTURES (paint; their frames are wood, in the building): a horse on a ridge at sunset, mountains over a lake,
// a lady in an oval
function drawPictures(g, A) {
  const [p0, p1, p2] = A.pictures;
  pixels(g, p0, (u, v) => {
    const sky = [230 - 80 * v, 150 - 60 * v, 80 - 20 * v], ridge = 0.68 + 0.06 * Math.sin(u * 5);
    if (v > ridge) return [70, 46, 30];
    const hx = (u - 0.55) / 0.2, hy = (v - (ridge - 0.12)) / 0.12, horse = (hx * hx + hy * hy < 1 && hy < 0.6) || (Math.abs(u - 0.68) < 0.03 && v > ridge - 0.26 && v < ridge - 0.1) || (Math.abs(u - 0.45) < 0.015 && v > ridge - 0.08) || (Math.abs(u - 0.62) < 0.015 && v > ridge - 0.08);
    return horse ? [40, 26, 20] : sky;
  });
  pixels(g, p1, (u, v) => {
    const m = 0.45 - 0.25 * Math.abs(Math.sin(u * 4.2 + 0.4)) - 0.1 * Math.abs(Math.sin(u * 9));
    if (v < m) return [150 + 60 * v, 180 + 40 * v, 210];
    if (v < 0.6) { const snow = v < m + 0.05 ? 1 : 0; return snow ? [235, 235, 240] : [90, 100, 110]; }
    if (v < 0.78) return [60 + 40 * Math.sin(u * 30) * 0.2, 110, 150];
    return [60, 80, 40];
  });
  pixels(g, p2, (u, v) => {
    const d = Math.hypot((u - 0.5) / 0.42, (v - 0.5) / 0.48);
    if (d > 1) return [40, 30, 22];
    const head = Math.hypot((u - 0.5) / 0.14, (v - 0.36) / 0.17) < 1, body = v > 0.55 && Math.abs(u - 0.5) < 0.12 + (v - 0.55) * 0.9, hair = Math.hypot((u - 0.5) / 0.17, (v - 0.3) / 0.17) < 1 && v < 0.36;
    if (hair) return [60, 40, 26];
    if (head) return [214, 176, 150];
    if (body) return [70, 40, 60];
    return [190, 180, 150];
  });
}
// paper, aged: cream going brown at the edges, a few stains
function oldPaper(u, v, seed) {
  const e = Math.min(u, 1 - u, v, 1 - v), age = sstep(0.1, 0.0, e) * 0.35 + 0.12 * fbm(u * 6, v * 6, 3, seed);
  return [236 - 70 * age, 224 - 84 * age, 190 - 90 * age];
}
function drawPoster(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v) => { const c = oldPaper(u, v, 991); return [c[0], c[1], c[2], 255 * sstep(0.0, 0.015, Math.min(u, 1 - u, v, 1 - v) + 0.01 * hash(u * 999 | 0, v * 999 | 0, 993))]; });
  g.save(); g.translate(x0, y0);
  g.fillStyle = '#2a1a12'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = SLAB(16, 700); g.fillText('★  T O N I G H T  ★', w / 2, 24);
  g.fillStyle = '#9a2a1e'; handLetters(g, 'THE', w / 2, 52, w * 0.5, 22, RYE, { wob: 0.5 });
  g.fillStyle = '#9a2a1e'; handLetters(g, 'MATHWOOD', w / 2, 82, w * 0.88, 36, RYE, { wob: 0.5 });
  handLetters(g, 'BAND', w / 2, 118, w * 0.6, 36, RYE, { wob: 0.5 });
  g.fillStyle = '#2a1a12'; g.font = SLAB(14, 700); g.fillText('PIANO · HARMONICA', w / 2, 150); g.fillText('SONGS FOR ALL', w / 2, 170);
  g.strokeStyle = '#2a1a12'; g.lineWidth = 2; g.strokeRect(10, 186, w - 20, 44);
  g.font = SLAB(13, 700); g.fillText('SARSAPARILLA 5¢', w / 2, 199); g.fillText('ALL WELCOME', w / 2, 218);
  g.restore();
}
function drawMenu(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v) => { const l = 0.8 + 0.2 * fbm(u * 6, v * 2, 3, 1001); return [44 * l, 30 * l, 22 * l]; });
  g.save(); g.translate(x0, y0);
  g.fillStyle = '#e8dcb8'; g.textBaseline = 'middle';
  g.font = RYE(17); g.textAlign = 'center'; g.fillText('DRINKS', w / 2, 13);
  g.font = SLAB(12, 700); g.textAlign = 'left';
  [['SARSAPARILLA', '5¢'], ['ROOT BEER', '5¢'], ['CREAM SODA', '5¢'], ['LEMONADE', '3¢']].forEach(([a, b], i) => { g.fillText(a, 14, 33 + i * 17); g.textAlign = 'right'; g.fillText(b, w - 14, 33 + i * 17); g.textAlign = 'left'; });
  g.restore();
}
function drawNotice(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v) => { const c = oldPaper(u, v, 1011); return [c[0], c[1], c[2], 255 * sstep(0, 0.02, Math.min(u, 1 - u, v, 1 - v))]; });
  g.save(); g.translate(x0, y0); g.fillStyle = '#2a1a12'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = RYE(18); g.fillText('NOTICE', w / 2, 22);
  g.font = SLAB(12, 700); ['WIPE YOUR BOOTS', 'NO HORSES', 'INSIDE', '', 'MIND THE', 'BATWING DOORS'].forEach((t, i) => g.fillText(t, w / 2, 50 + i * 17));
  g.restore();
}
// THE ROOM NUMBERS: small oval brass plates, "No." and the figure in a period display face, engraved
function drawPlates(g, A) {
  A.plates.forEach((r, i) => {
    pixels(g, r, (u, v) => {
      const e = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5);
      if (e > 1) return [0, 0, 0, 0];
      const l = 0.7 + 0.3 * (1 - v) - (e > 0.85 ? 0.25 : 0);
      return [176 * l, 132 * l, 60 * l, 255];
    });
    g.save(); g.fillStyle = '#2a1608'; g.textBaseline = 'middle';
    g.textAlign = 'right'; g.font = 'italic 400 11px Georgia, serif'; g.fillText('No.', r[0] + r[2] * 0.48, r[1] + r[3] / 2 + 2);
    g.textAlign = 'left'; g.font = RYE(22); g.fillText(String(i + 1), r[0] + r[2] * 0.52, r[1] + r[3] / 2 + 2);
    g.restore();
  });
}
// THE ROOMS' PICTURES: a patchwork quilt in faded period cottons (madder red, indigo, butternut, cream), a braided rag rug
// (an oval of coils in muted colours), blue bed ticking, a lighter wallpaper (a small sprig on cream-rose), and the sky's
// reflection for the street windows (a soft band of pale sky fading down to nothing)
function drawQuilt(g, [x0, y0, w, h]) {
  const C = [[150, 74, 60], [70, 82, 110], [178, 140, 88], [214, 200, 170], [110, 96, 70], [128, 108, 120]];
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    const n = 8, i = Math.floor(u * n), j = Math.floor(v * n), fu = u * n - i, fv = v * n - j;
    const tri = fu > fv ? 0 : 1, c = C[Math.floor(hash(i * 2 + tri, j, 1051) * C.length)];
    const seam = Math.min(fu, fv, 1 - fu, 1 - fv, Math.abs(fu - fv)) < 0.04 ? 0.8 : 1, l = (0.88 + 0.1 * fbm(u * 8, v * 8, 2, 1053)) * seam;
    return c.map((q) => q * l);
  });
}
function drawRagRug(g, [x0, y0, w, h]) {
  const C = [[132, 92, 70], [90, 84, 100], [160, 130, 96], [110, 70, 60], [120, 120, 96]];
  pixels(g, [x0, y0, w, h], (u, v) => {
    const d = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5);
    if (d > 1) return [0, 0, 0, 0];
    const ring = Math.floor(d * 9), c = C[ring % C.length], braid = 0.8 + 0.2 * Math.abs(Math.sin(Math.atan2(v - 0.5, u - 0.5) * 30 + ring));
    return [...c.map((q) => q * braid), 255 * sstep(1.0, 0.95, d)];
  });
}
function drawTicking(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v, x) => { const s = (x % 16) < 3 ? [70, 84, 112] : (x % 16) < 4 ? [150, 150, 140] : [214, 208, 190]; return s.map((q) => q * (0.92 + 0.08 * hash(x, 0, 1061))); });
}
function drawSky(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v) => [196, 210, 220, 255 * 0.32 * sstep(0.75, 0.0, v) * (0.85 + 0.15 * Math.sin(u * 9))]);
}
function drawRoomPaper(g, r) { drawDamask(g, r, [196, 172, 150], [176, 150, 128], 'rgba(120,130,96,0.35)', 4, 1071); }
// a rug: a dark red ground, a border, a medallion
function drawRug(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v) => {
    const e = Math.min(u, 1 - u, v, 1 - v), md = Math.abs(u - 0.5) + Math.abs(v - 0.5);
    let c = [120, 30, 26];
    if (e < 0.08) c = [50, 30, 40]; else if (e < 0.12) c = [190, 150, 80]; else if (md < 0.18) c = [190, 150, 80]; else if (md < 0.25) c = [40, 50, 80];
    const n = 0.85 + 0.15 * hash(u * 128 | 0, v * 128 | 0, 1021);
    return c.map((q) => q * n);
  });
}
function drawKeys(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v, x) => {
    const kw = w / 36, k = Math.floor(x / kw), f = (x - k * kw) / kw;
    const white = f > 0.06 ? [236, 228, 206] : [120, 110, 96];
    const pat = [1, 1, 0, 1, 1, 1, 0], o = k % 7, black = pat[o] && v < 0.62 && f > 0.68;
    const blackL = k > 0 && pat[(k - 1) % 7] && v < 0.62 && f < 0.32;
    return black || blackL ? [24, 20, 18] : white;
  });
}
function drawMusic(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v, x, y) => {
    const c = oldPaper(u, v, 1031), r = y % 16, staff = r >= 2 && r <= 10 && r % 2 === 0 && y > 8 && x > 4 && x < w - 4 ? 0.55 : 1;
    const note = hash(x >> 2, y >> 2, 1033) > 0.94 && y > 8 ? 0.2 : 1;
    return c.map((q) => q * Math.min(staff, note));
  });
}
function drawTiles(g, A) {
  const C = { brass: [196, 150, 64], leather: [92, 34, 26], lacquer: [26, 20, 16], felt: [44, 72, 46], ivory: [232, 222, 196], tin: [150, 150, 148],
    darkwood: [70, 40, 24], gold: [214, 168, 70], black: [18, 16, 14], cream: [226, 212, 176], amber: [140, 70, 20], glass: [190, 200, 196] };
  for (const k in A.tile) pixels(g, A.tile[k], (u, v, x, y) => { const n = 0.88 + 0.12 * fbm(u * 4, v * 4, 2, 1041 + x * 0) + 0.04 * (hash(x, y, 1043) - 0.5); return C[k].map((q) => Math.min(255, q * n * (k === 'brass' || k === 'gold' ? 0.85 + 0.3 * (1 - v) : 1))); });
}
// the wainscot's panel moulding seen face on (a strip that tiles across): not used for geometry, a darker border band
function drawWainscot(g, [x0, y0, w, h]) {
  pixels(g, [x0, y0, w, h], (u, v) => { const l = 0.8 + 0.2 * Math.sin(v * Math.PI); return [70 * l, 42 * l, 26 * l]; });
}

let ART_CACHE = null;
export async function makeSaloonArt() {
  if (ART_CACHE) return ART_CACHE;
  try { await Promise.all([document.fonts.load('64px Rye'), document.fonts.load('900 64px Bitter'), document.fonts.load('800 40px Bitter'), document.fonts.load('700 16px Bitter')]); } catch (e) { /* the fonts are optional */ }
  const t0 = performance.now(), A = SALOON_ART, c = canvasOf(A.w, A.h), g = c.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, A.w, A.h);
  drawSign(g, A.sign); drawGold(g, A.gold); drawLace(g, A.lace); drawVelvet(g, A.velvet); drawFringe(g, A.fringe); drawPaper(g, A.paper);
  drawChalk(g, A.chalk); A.bottles.forEach((r, i) => drawBottles(g, r, 1101 + i * 7)); drawMirror(g, A.mirror); drawPictures(g, A);
  drawPoster(g, A.poster); drawMenu(g, A.menu); drawNotice(g, A.notice); drawPlates(g, A); drawRug(g, A.rug); drawKeys(g, A.keys); drawMusic(g, A.music);
  drawTiles(g, A); drawWainscot(g, A.wainscot);
  drawQuilt(g, A.quilt); drawRagRug(g, A.ragrug); drawTicking(g, A.ticking); drawSky(g, A.sky); drawRoomPaper(g, A.roomPaper);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  ART_CACHE = { saloon: t, canvas: c, bytes: gpuBytes(A.w, A.h), ms: performance.now() - t0 };
  return ART_CACHE;
}

// ── the props ────────────────────────────────────────────────────────────────────────────────────────────────────────
const FURN = [0.62, 0.42, 0.3], DARKF = [0.46, 0.3, 0.2], BRASS = [1.5, 1.15, 0.6];
const put = (k, M) => ({
  b: (size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  x: (group, size, pos, rot, o = {}) => k.box(group, size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  p: (group, poly, len, pos, rot, o = {}) => k.prism(group, poly, len, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  // a square board from point a to point b (its ends on them: a leg from under a seat to the floor, a stretcher from one
  // leg's middle to another's), w thick
  rod: (w, a, b, o = {}) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    const R = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    return k.board([w, L, w], null, null, { long: 1, ...o, m: mul(M, T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), R) });
  },
});
// a point up a leg running from its top `t` (under the seat) to its foot `f` (on the floor), at height y
const upLeg = (t, f, y) => { const u = (y - f[1]) / (t[1] - f[1]); return [f[0] + (t[0] - f[0]) * u, y, f[2] + (t[2] - f[2]) * u]; };
const SALOON_MAKERS = {
  // a round pedestal table: a round top (12 sides) with a thin apron under its edge, a turned column, four feet
  roundTable(k, M, o) {
    const q = put(k, M), r = o.r ?? 0.46, H = 0.76, tint = vary(k, FURN, 0.9, 1.1);
    q.p('wood', ngon(12, r), 0.035, [0, H - 0.0175, 0], null, { tint, smooth: true, long: 0, strip: 3 });
    q.p('wood', ngon(12, r - 0.03), 0.06, [0, H - 0.065, 0], null, { tint: tint.map((c) => c * 0.8), smooth: true, skip: '+y-y' });
    q.p('wood', ngon(6, 0.05), 0.3, [0, 0.52, 0], null, { tint, smooth: true, taper: 0.25, skip: '+y-y' });
    q.p('wood', ngon(6, 0.065), 0.32, [0, 0.22, 0], null, { tint, smooth: true, taper: -0.3, skip: '+y-y' });   // (down into the feet)
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; q.b([0.06, 0.06, 0.34], [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15], [0.12, a, 0], { long: 2, tint: tint.map((c) => c * 0.85) }); }
    k.solid([r * 1.6, 0.05, r * 1.6], null, null, mul(M, T(0, H - 0.03, 0)));
    k.solid([0.14, H, 0.14], null, null, mul(M, T(0, H / 2, 0)));
  },
  // a spindle-back chair facing +z (its back at -z): legs from under the seat splayed out to the floor, stretchers
  // between them (one each side and one across the front, their ends in the legs), a round seat, two back posts and three
  // spindles standing on the seat, a top rail bent round the back from post to post
  spindleChair(k, M, o) {
    const q = put(k, M), tint = vary(k, FURN, 0.85, 1.12), S = 0.45, cz = 0.01;
    const leg = (sx, sz) => ({ t: [sx * 0.115, S + 0.006, sz * 0.11 + cz], f: [sx * 0.172, 0, sz * 0.168 + cz] });
    const L = { lb: leg(-1, -1), rb: leg(1, -1), rf: leg(1, 1), lf: leg(-1, 1) };
    for (const g of Object.values(L)) q.rod(0.035, g.t, g.f, { tint, skip: '-y+y' });
    for (const [a, b, y] of [[L.lb, L.lf, 0.2], [L.rb, L.rf, 0.2], [L.lf, L.rf, 0.15]]) q.rod(0.02, upLeg(a.t, a.f, y), upLeg(b.t, b.f, y), { tint, skip: '-y+y' });
    q.p('wood', ngon(8, 0.22), 0.035, [0, S + 0.017, cz], null, { tint: tint.map((c) => c * 1.05), smooth: true, long: 0, skip: '-y' });
    // (the back: posts and spindles from the seat's back up and leaning back 10 degrees, away from the sitter, the rail
    // across their tops bowed back between them: the game's maker saw the old one's rail point into the sitter's back)
    const top = S + 0.52, rake = Math.tan(10 * Math.PI / 180) * 0.5, z0 = -0.14 + cz, post = (sx) => [[sx * 0.13, S + 0.02, z0], [sx * 0.15, top, z0 - rake]];
    for (const sx of [-1, 1]) { const [a, b] = post(sx); q.rod(0.035, a, b, { tint, skip: '-y' }); }
    for (let i = 0; i < 3; i++) { const x = -0.065 + i * 0.065; q.rod(0.018, [x, S + 0.02, z0 - 0.01], [x, top - 0.03, z0 - 0.01 - rake - (0.02 - Math.abs(x) * 0.15)], { tint, skip: '-y+y' }); }
    for (const sx of [-1, 1]) {
      const a = [sx * 0.15, top, z0 - rake], b = [0, top, z0 - rake - 0.025], mid = [(a[0] + b[0]) / 2, top, (a[2] + b[2]) / 2], len = Math.hypot(b[0] - a[0], b[2] - a[2]) + 0.03;
      q.b([len, 0.07, 0.025], mid, [0, Math.atan2(-(b[2] - a[2]), b[0] - a[0]), 0], { long: 0, tint });
    }
    k.solid([0.42, S, 0.4], null, null, mul(M, T(0, S / 2, 0)));
  },
  // a tall bar stool: four legs, a footring, a round seat with a leather top (brass tacks round it)
  barStool(k, M, o) {
    const q = put(k, M), tint = vary(k, DARKF, 0.9, 1.1), H = 0.76;
    // (each leg from under the seat's edge out to the floor; the footring: a stretcher from each leg to the next, its ends
    // in them)
    const legs = [0, 1, 2, 3].map((i) => { const a = i * Math.PI / 2 + Math.PI / 4, sa = Math.sin(a), ca = Math.cos(a); return { t: [sa * 0.127, H + 0.004, ca * 0.127], f: [sa * 0.173, 0, ca * 0.173] }; });
    for (const g of legs) q.rod(0.04, g.t, g.f, { tint, skip: '-y+y' });
    for (let i = 0; i < 4; i++) { const a = legs[i], b = legs[(i + 1) % 4]; q.rod(0.025, upLeg(a.t, a.f, 0.26), upLeg(b.t, b.f, 0.26), { tint, skip: '-y+y' }); }
    q.p('wood', ngon(10, 0.19), 0.05, [0, H + 0.025, 0], null, { tint, smooth: true, long: 0 });
    q.p('wood', ngon(10, 0.175), 0.04, [0, H + 0.07, 0], null, { paint: [0.16, 0.05, 0.03], tint: [0.5, 0.45, 0.4], smooth: true, taper: 0.12, long: 0 });
    k.solid([0.36, H + 0.1, 0.36], null, null, mul(M, T(0, (H + 0.1) / 2, 0)));
  },
  // an upright piano, its keys facing +z: the case, its lid and moulding, carved cheeks, legs, the key bed and keys, the
  // fallboard, the music desk with a sheet on it, a raised panel below, pedals, two brass candle arms
  piano(k, M, o) {
    const q = put(k, M), C = vary(k, [0.42, 0.26, 0.17], 0.95, 1.05), W = 1.48, D = 0.6, H = 1.32, KY = 0.72;
    const lac = { paint: [0.07, 0.035, 0.02], tint: [0.5, 0.42, 0.36] };   // (a dark varnish, satin)
    q.b([W - 0.1, H - 0.08, D - 0.08], [0, (H - 0.08) / 2 + 0.04, -0.05], null, { long: 0, ...lac, skip: '-y' });   // the body
    q.b([W + 0.04, 0.05, D + 0.02], [0, H + 0.005, -0.04], null, { long: 0, ...lac });                               // the lid
    q.b([W, 0.06, 0.06], [0, H - 0.05, D / 2 - 0.04], null, { long: 0, ...lac });                                    // its moulding
    for (const s of [-1, 1]) {
      q.b([0.06, H, D + 0.04], [s * (W / 2 - 0.02), H / 2, -0.03], null, { long: 1, ...lac });                          // the cheeks
      q.b([0.07, KY - 0.06, 0.07], [s * (W / 2 - 0.05), (KY - 0.06) / 2, D / 2 + 0.1], null, { long: 1, ...lac, skip: '-y' });   // the legs
      q.b([0.07, 0.07, 0.3], [s * (W / 2 - 0.05), 0.035, D / 2 - 0.02], null, { long: 2, ...lac });                   // the toe blocks
      q.b([0.1, 0.12, 0.1], [s * (W / 2 - 0.05), KY - 0.06, D / 2 + 0.1], null, { long: 1, ...lac });                  // a carved console under the key bed
      // a brass candle arm on the front, a candle in it
      q.x('iron', [0.012, 0.012, 0.16], [s * (W / 2 - 0.22), 1.08, D / 2 - 0.0], [0, 0, 0], { tint: BRASS });
      q.p('iron', ngon(6, 0.03), 0.02, [s * (W / 2 - 0.22), 1.09, D / 2 + 0.08], null, { tint: BRASS, smooth: true });
      q.p('wood', ngon(6, 0.012), 0.12, [s * (W / 2 - 0.22), 1.16, D / 2 + 0.08], null, { paint: [0.8, 0.76, 0.66], tint: [1, 1, 1], smooth: true });
    }
    q.b([W - 0.06, 0.06, 0.28], [0, KY - 0.03, D / 2 + 0.1], null, { long: 0, ...lac });                               // the key bed
    q.b([W - 0.12, 0.08, 0.04], [0, KY + 0.04, D / 2 + 0.22], null, { long: 0, ...lac });                              // its rail
    if (o.gd) o.gd.box([W - 0.14, 0.02, 0.15], mul(M, T(0, KY + 0.01, D / 2 + 0.12)), { '+y': SALOON_ART.keys, '+z': SALOON_ART.tile.ivory }, [1, 1, 1]);
    q.b([W - 0.12, 0.2, 0.03], [0, KY + 0.16, D / 2 + 0.04], [-0.12, 0, 0], { long: 0, ...lac });                     // the fallboard
    q.b([W * 0.5, 0.03, 0.08], [0, 0.98, D / 2 + 0.02], null, { long: 0, ...lac });                                    // the music desk's ledge
    if (o.gd) o.gd.box([0.24, 0.3, 0.004], mul(M, T(-0.12, 1.12, D / 2 + 0.0), RX(-0.2), RZ(0.03)), { '+z': SALOON_ART.music }, [1, 1, 1]);
    if (o.gd) o.gd.box([0.24, 0.3, 0.004], mul(M, T(0.13, 1.12, D / 2 + 0.0), RX(-0.2), RZ(-0.02)), { '+z': SALOON_ART.music }, [0.95, 0.95, 0.92]);
    // the front's panels: a raised panel in the upper front, two in the lower
    q.b([W * 0.7, 0.26, 0.015], [0, 1.08, D / 2 - 0.035], null, { long: 0, ...lac, skip: '-z' });
    for (const s of [-1, 1]) q.b([W * 0.36, 0.34, 0.015], [s * W * 0.22, 0.3, D / 2 - 0.035], null, { long: 0, ...lac, skip: '-z' });
    for (let i = -1; i <= 1; i++) q.x('iron', [0.03, 0.012, 0.08], [i * 0.07, 0.06, D / 2 - 0.0], null, { tint: BRASS });
    k.solid([W, H, D], null, null, mul(M, T(0, H / 2, -0.04)));
  },
  pianoStool(k, M, o) {
    const q = put(k, M), tint = vary(k, DARKF, 0.9, 1.05);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; q.b([0.035, 0.46, 0.035], [Math.sin(a) * 0.13, 0.23, Math.cos(a) * 0.13], [-Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], { long: 1, tint, skip: '-y+y' }); }
    q.p('wood', ngon(8, 0.11), 0.06, [0, 0.47, 0], null, { tint, smooth: true, long: 0 });
    q.p('wood', ngon(10, 0.19), 0.06, [0, 0.52, 0], null, { paint: [0.2, 0.05, 0.04], tint: [0.5, 0.45, 0.4], smooth: true, taper: 0.15, long: 0 });
    k.solid([0.36, 0.55, 0.36], null, null, mul(M, T(0, 0.27, 0)));
  },
};
// THE ROOMS UPSTAIRS: a bed, a washstand, a rag rug (and a spindle chair), a few hundred triangles a room
Object.assign(SALOON_MAKERS, {
  // a wooden bed lying along z, its head at -z: turned posts (taller at the head), a headboard and a lower footboard,
  // side rails, a mattress (blue ticking) under a patchwork quilt, a pillow
  bed(k, M, o) {
    const q = put(k, M), tint = vary(k, FURN, 0.85, 1.05), W = o.w ?? 1.0, L = o.len ?? 1.95, H = 0.4;
    for (const [sx, sz, h] of [[-1, -1, 1.12], [1, -1, 1.12], [-1, 1, 0.78], [1, 1, 0.78]]) q.p('wood', ngon(6, 0.035), h, [sx * (W / 2 - 0.035), h / 2, sz * (L / 2 - 0.035)], null, { tint, smooth: true, skip: '-y' });
    q.b([W - 0.07, 0.55, 0.03], [0, 0.78, -L / 2 + 0.035], null, { long: 0, tint });
    q.b([W - 0.07, 0.3, 0.03], [0, 0.56, L / 2 - 0.035], null, { long: 0, tint });
    for (const sd of [-1, 1]) q.b([0.03, 0.15, L - 0.07], [sd * (W / 2 - 0.035), 0.3, 0], null, { long: 2, tint, skip: '-y' });
    if (o.gd) {
      const A = SALOON_ART;
      o.gd.box([W - 0.06, 0.17, L - 0.08], mul(M, T(0, H, 0)), { '+y': A.quilt, '+x': A.quilt, '-x': A.quilt, '+z': A.ticking }, vary(k, [1, 1, 1], 0.92, 1.05));
      o.gd.box([W - 0.3, 0.1, 0.34], mul(M, T(0, H + 0.12, -L / 2 + 0.26), RX(0.15)), { '+y': A.tile.cream, '+z': A.tile.cream, '+x': A.tile.cream, '-x': A.tile.cream }, [1, 1, 1]);
    }
    k.solid([W, 0.6, L], null, null, mul(M, T(0, 0.3, 0)));
  },
  // a washstand, its back to the wall (at -z): a cupboard with a door, a top and a splashback; a white ironstone basin
  // and pitcher on it
  washstand(k, M, o) {
    const q = put(k, M), tint = vary(k, FURN, 0.85, 1.05), EN = [1.6, 1.58, 1.5];
    q.b([0.62, 0.7, 0.4], [0, 0.35, 0], null, { long: 0, tint, skip: '-y-z' });
    q.b([0.66, 0.03, 0.44], [0, 0.715, 0.01], null, { long: 0, tint });
    q.b([0.62, 0.16, 0.02], [0, 0.81, -0.19], null, { long: 0, tint, skip: '-z' });
    q.b([0.48, 0.5, 0.012], [0, 0.34, 0.205], null, { long: 1, tint: tint.map((c) => c * 1.1), skip: '-z' });
    q.p('iron', ngon(8, 0.16), 0.07, [0, 0.765, 0.03], null, { tint: EN, smooth: true, taper: -0.3 });
    q.p('iron', ngon(8, 0.065), 0.16, [0.03, 0.88, 0.03], null, { tint: EN, smooth: true, taper: -0.2, skip: '-y' });
    q.p('iron', ngon(8, 0.058), 0.08, [0.03, 1.0, 0.03], null, { tint: EN, smooth: true, taper: 0.25 });
    k.solid([0.62, 0.8, 0.4], null, null, mul(M, T(0, 0.4, 0)));
  },
  // a braided rag rug on the floor: an oval (the saloon's picture), see-through round it
  ragRug(k, M, o) {
    if (!o.decals) return;
    const w = o.w ?? 1.3, l = o.len ?? 0.85, g = new THREE.PlaneGeometry(w, l), [u0, v0, u1, v1] = regionUV(SALOON_ART.ragrug), U = g.attributes.uv;
    for (let i = 0; i < U.count; i++) U.setXY(i, u0 + (u1 - u0) * U.getX(i), v0 + (v1 - v0) * U.getY(i));
    g.applyMatrix4(mul(M, T(0, 0.006, 0), RX(-Math.PI / 2))); o.decals.push(g);
  },
});
Object.assign(MAKERS, SALOON_MAKERS);
export { SALOON_MAKERS };
