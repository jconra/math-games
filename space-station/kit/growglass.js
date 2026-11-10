// THE GROW PODS' GLASS (the pods themselves: kit/shipparts/cabin/growpod.js): frosted glass with green plants behind it,
// under a grow lamp. The game's maker, 2026-11-09: "Maybe it could be a bit blurry like it has frosted glass over it,
// with green plants showing." "Maybe the plant chamber could be slowly spinning the plants."
//   No blur is worked out while the game runs and nothing is drawn twice: each KIND of pod (a planting, how frosted, a
//   seed) is painted ONCE as two small pictures on one shared sheet, already blurred:
//     near   the leaves close behind the glass (a little soft), with see-through gaps between them
//     far    the pod's dark back, what holds the plants, and the leaves further in (a lot softer)
//   The glass shows the near picture over the far one, each shifted by how far behind the glass it is and by where it is
//   looked at from, so the plants slide a little behind the frame as the eye moves (depth: not a sticker), and the pod's
//   own side wall shows on the side looked from.
//   THE LAMP is not in the pictures: the glass draws it (a soft strip along the top behind the near leaves, or one thin
//   line round the rim in front of them; pink-white or warm white, never as bright as white), adds its glow in the
//   frost and shades the plants by how near it they are. The gaps between the leaves are the pod's dark back, so what
//   is seen is leaves, not a lamp.
//   THE TURNING: a pod's pictures can turn slowly round its middle (a rotary garden: plants in clay pots on a wheel),
//   or its near leaves sway a little from side to side. The lamp, its light, the frost's grain and the frame stay where
//   they are, and the turning plants HANG a little toward the pod's floor (GROW.sag), so a leaf changes its shape and
//   its brightness on its way round (a picture is not seen spinning on a pin). All of it is worked out on the graphics
//   card from one clock (the kit's U.time): nothing is done for it each frame.
//   Over that: the frost's milky haze (thicker seen from the side), its fine grain (faded out with distance), a shadow
//   under the frame's rim and a faint slanting sheen that slides as the eye moves.
//   One material and one texture for every pod, so all the pods in a room's batch are ONE draw.
//
//   GROW                 the numbers: glow (how bright the glass is), sheet (the sheet's width), near / far (the depths),
//                        turn (a turning pod's seconds a turn), sag (how far turning plants hang), stir (how far
//                        swaying leaves move)
//   FROST                the three frosts' numbers
//   podCell(plant, frost, seed)   where a kind's two pictures are on the sheet (painted the first time it is asked for)
//   podSheet()           the sheet itself (for a lab to show, or to count)
//   podGlass(time)       the material; time: a { value } of seconds (the kit's U.time) for the slow movement
//
// TO SWITCH IT ON, the pods' three materials go in the kit's list: three lines in kit/materials.js
//   import { podGlass, podInside, podPane } from './growglass.js';      (with the other imports)
//   M.pod = podGlass(U.time); M.podInst = M.pod; M.podIn = podInside(U.time); M.podInInst = M.podIn; M.podPane = podPane(); M.podPaneInst = M.podPane;
//                                                                       (in makeMaterials(), with the other materials)
//   'pod', 'podIn', 'podPane' in MAT_KEYS, before 'glass':
//     ['solid', 'floor', 'decal', 'screen', 'glow', 'core', 'driveGlow', 'pod', 'podIn', 'podPane', 'glass', 'shield']
//   ('pod' draws the picture pods; 'podIn' and 'podPane' the real-plant ones: see REAL PLANTS, below)
//
// THE SHEET: 512 pixels high, GROW.sheet wide (512: three kinds; 1024: six). Near pictures 256 x 256, far ones 128 x 128.
// sRGB, 8 bits, with mip levels (about 1.4 MB on the graphics card at 512 x 512).
import * as THREE from 'three';

const UGLOW = { value: 1.2 };
export const GROW = {
  // HOW BRIGHT THE GLASS IS (every pod's, at once: GROW.glow = 1 shows on the next frame). The lamp comes out at about
  // 0.7 of this, lit leaves at 0.1 to 0.4 of it, the gaps between them under 0.1 (the kit's light strips are 3, and the
  // glow pass picks up 2 and over: a pod never spreads into a white disc).
  get glow() { return UGLOW.value; }, set glow(v) { UGLOW.value = v; },
  sheet: 512,        // the sheet's width, pixels (512 for each three kinds of pod): set before the first pod is made
  near: 0.018,       // how far behind the glass the near leaves are, metres (set before the materials are made)
  far: 0.075,        // and the pod's back, its lamp and the far leaves
  turn: 60,          // a turning pod's seconds for one turn ("slowly spinning the plants"); a pod's own o.turn overrides it
  sag: 0.12,         // how far a turning pod's plants hang toward its floor at its middle, in half-sizes of the glass
                     // (0: the planting turns as one stiff picture; set before the materials are made)
  stir: 0.028,       // how far a stirring pod's near leaves sway, in half-sizes of the glass
};
// how frosted: each picture's blur (as a share of the glass's half-size), the milky haze, the grain
export const FROST = {
  light: { near: 0.016, far: 0.05, haze: 0.07, grain: 0.09 },
  medium: { near: 0.022, far: 0.065, haze: 0.14, grain: 0.14 },
  heavy: { near: 0.036, far: 0.1, haze: 0.21, grain: 0.2 },
};
export const PLANTS = ['ring', 'climb', 'herbs'];

const E = 1.25, NEAR = 256, FAR = 128, H = 512;   // (a picture reaches E half-sizes out from the glass's middle: room for the shift)
const PI = Math.PI, TAU = PI * 2;
const rand = (seed) => { let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ── the painting (a 2D canvas in the glass's own units: x right, y up, the glass from -1 to 1) ────────────────────
// The colours are the plants' own under the lamp's full light: the glass does the shading.
// a leaf green: from yellow-green to a deep blue-green (hue shifts it), lift makes it paler
const green = (R, lift = 0, hue = 0) => `hsl(${(76 + hue + 46 * R()).toFixed(0)} ${(44 + 26 * R()).toFixed(0)}% ${(25 + lift + 20 * R()).toFixed(0)}%)`;
// a leaf from its stem end at (x, y), `len` long and `wid` wide at its widest, pointing along `ang`: one half a little
// darker (its fold), a dark edge (so leaves lying over one another stay apart through the frost), a pale rib
function leaf(c, x, y, len, wid, ang, R, lift = 0, hue = 0) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(len * 0.2, -wid * 0.62, len * 0.72, -wid * 0.55, len, 0); c.bezierCurveTo(len * 0.72, wid * 0.55, len * 0.2, wid * 0.62, 0, 0);
  c.fillStyle = green(R, lift, hue); c.fill();
  c.strokeStyle = 'rgba(5,22,9,0.4)'; c.lineWidth = Math.max(0.012, wid * 0.08); c.stroke();
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(len * 0.2, wid * 0.62, len * 0.72, wid * 0.55, len, 0); c.closePath(); c.fillStyle = 'rgba(6,34,10,0.26)'; c.fill();
  c.strokeStyle = 'rgba(214,240,160,0.42)'; c.lineWidth = Math.max(0.009, wid * 0.07); c.beginPath(); c.moveTo(len * 0.05, 0); c.lineTo(len * 0.88, 0); c.stroke();
  c.restore();
}
// a tuft standing at (x, y), `h` high: 0 broad leaves in a fan, 1 thin blades, 2 a low bush of small leaves
function tuft(c, x, y, h, R, lift, kind) {
  if (kind === 0) { for (let i = 0; i < 6; i++) { const a = PI / 2 + ((i + 0.5) / 6 * 2 - 1) * 0.95 + (R() - 0.5) * 0.2, l = h * (0.6 + 0.4 * R()); leaf(c, x + (R() - 0.5) * 0.06, y, l, l * 0.58, a, R, lift, -6); } }
  else if (kind === 1) { c.lineCap = 'round'; for (let i = 0; i < 11; i++) { const a = ((i + 0.5) / 11 * 2 - 1) * 0.5 + (R() - 0.5) * 0.12, l = h * (0.75 + 0.4 * R()); c.strokeStyle = green(R, lift + 4, 16); c.lineWidth = 0.03 + 0.014 * R(); c.beginPath(); c.moveTo(x + (R() - 0.5) * 0.1, y); c.quadraticCurveTo(x + Math.sin(a) * l * 0.4, y + l * 0.6, x + Math.sin(a) * l * 1.1, y + Math.cos(a) * l); c.stroke(); } }
  else { for (let i = 0; i < 12; i++) { const a = R() * PI, r = h * 0.62 * Math.sqrt(R()), px = x + Math.cos(a) * r * 0.75, py = y + 0.06 + Math.sin(a) * r, l = h * (0.3 + 0.16 * R()); leaf(c, px, py, l, l * 0.8, R() * TAU, R, lift + 4, 4); } }
}
// a clay pot standing at (0, 0) of the canvas as it is now (its mouth up, `w` wide), soil in its mouth
function pot(c, w, h) {
  c.fillStyle = '#8f6a4c'; c.beginPath(); c.moveTo(-w * 0.36, 0); c.lineTo(w * 0.36, 0); c.lineTo(w * 0.5, h); c.lineTo(-w * 0.5, h); c.closePath(); c.fill();
  c.fillStyle = '#b48a66'; c.fillRect(-w * 0.54, h * 0.74, w * 1.08, h * 0.2);
  c.fillStyle = '#2a1d13'; c.fillRect(-w * 0.44, h * 0.94, w * 0.88, h * 0.12);
}
// a leafy head rooted at (x, y), opening toward `ang`: a fan of broad leaves, the outer ones first (shorter, deeper
// green), the young middle ones on top (longer, paler)
function head(c, x, y, ang, size, R, lift = 0, hue = 0) {
  const n = 7 + Math.floor(R() * 2), list = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * 2 - 1; list.push([Math.abs(t), ang + t * 1.05 + (R() - 0.5) * 0.2, size * (1.0 - 0.42 * Math.abs(t)) * (0.88 + 0.24 * R())]); }
  list.sort((a, b) => b[0] - a[0]);
  for (const [t, a, len] of list) leaf(c, x, y, len, len * (0.5 + 0.14 * R()), a, R, lift + (1 - t) * 12, hue - 8 * (1 - t));
}
const PAINT = {
  // THE ROTARY GARDEN: a wheel (three spokes on the dark back) with five potted plants on its rim, growing in toward
  // the middle: three leafy stems of different lengths (long enough to cross the middle), a broad-leaved head and a
  // thin-bladed tuft between them, none of them evenly spaced. The plants differ, so each is seen going round, and
  // their tips fill the middle (a ring of like plants round a dark middle reads as an eye, or a kaleidoscope).
  // Darker heads and a few loose leaves fill in behind.
  ring(N, F, R) {
    const g = F.createRadialGradient(0, 0, 0, 0, 0, 1.3); g.addColorStop(0, '#202e26'); g.addColorStop(1, '#0d1410');
    F.fillStyle = g; F.fillRect(-E, -E, 2 * E, 2 * E);
    const a0 = R() * TAU, n = 5, lens = [1.08, 0.8, 0.94], l0 = Math.floor(R() * 3);
    F.strokeStyle = '#46584f'; F.lineWidth = 0.05;
    for (let i = 0; i < 3; i++) { const a = a0 + 0.26 + i * TAU / 3; F.beginPath(); F.moveTo(0, 0); F.lineTo(1.5 * Math.cos(a), 1.5 * Math.sin(a)); F.stroke(); }
    for (let i = 0; i < n; i++) { const a = a0 + (i + 0.5 + (R() - 0.5) * 0.3) / n * TAU; head(F, Math.cos(a), Math.sin(a), a + PI + (R() - 0.5) * 0.3, 0.4 + 0.14 * R(), R, -9, 16); }
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + (R() - 0.5) * 0.34) / n * TAU;
      // (the plant's own place: its pot's foot on the rim, up = toward the middle)
      N.save(); N.translate(0.95 * Math.cos(a), 0.95 * Math.sin(a)); N.rotate(a + PI / 2 + (R() - 0.5) * 0.3);
      pot(N, 0.34, 0.17);
      if (i === 1) head(N, 0, 0.16, PI / 2, 0.56 + 0.12 * R(), R, 5, -10);
      else if (i === 3) tuft(N, 0, 0.16, 0.6 + 0.1 * R(), R, 6, 1);
      else {
        const len = lens[(i / 2 + l0) % 3] * (0.94 + 0.12 * R()), bend = (R() - 0.5) * 0.6, ph = R() * TAU, at = (y) => bend * y * y / len + 0.05 * Math.sin(y * 5 + ph);
        N.strokeStyle = '#6b8a3c'; N.lineWidth = 0.05; N.lineCap = 'round'; N.beginPath(); for (let y = 0.16; y <= len; y += 0.05) N[y === 0.16 ? 'moveTo' : 'lineTo'](at(y), y); N.stroke();
        let side = R() < 0.5 ? 1 : -1;
        for (let y = 0.24; y <= len; y += 0.15 + 0.08 * R()) { const t = y / len, s = 0.44 - 0.22 * t + 0.07 * R(); side = -side; leaf(N, at(y), y, s, s * (0.6 + 0.16 * R()), PI / 2 - side * (0.8 + 0.6 * R()), R, 2 + t * 12, [0, 16, -12][i / 2] - 8 * t); }
      }
      N.restore();
    }
  },
  // CLIMBERS: a honeycomb frame on the dark back, a few loose leaves low down behind; in front a planter along the
  // bottom and three or four stems out of it, each leaning its own way and stopping at its own height, their leaves
  // big at the foot and small at the tip. The frame shows between the stems (leaves spread evenly all over read as
  // a printed pattern).
  climb(N, F, R) {
    const g = F.createLinearGradient(0, E, 0, -E); g.addColorStop(0, '#263630'); g.addColorStop(1, '#111915');
    F.fillStyle = g; F.fillRect(-E, -E, 2 * E, 2 * E);
    F.strokeStyle = 'rgba(138,166,144,0.7)'; F.lineWidth = 0.05; const hr = 0.3;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const cx = i * hr * 1.732 + (j & 1 ? hr * 0.866 : 0), cy = j * hr * 1.5;
      F.beginPath(); for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; F[k ? 'lineTo' : 'moveTo'](cx + hr * Math.cos(a), cy + hr * Math.sin(a)); } F.closePath(); F.stroke();
    }
    for (let i = 0; i < 12; i++) { const y = -0.7 + 1.1 * R() ** 1.7, x = (R() * 2 - 1) * E, s = 0.24 + 0.16 * R(); leaf(F, x, y, s, s * 0.62, PI / 2 + (R() - 0.5) * 2.6, R, -8, 14); }
    const n = 3 + (R() < 0.5 ? 1 : 0), tops = [1.1, 0.5, 0.85, 0.15], t0 = Math.floor(R() * 4), stems = [];
    for (let i = 0; i < n; i++) {
      const x0 = -0.78 + 1.56 * (i + 0.5) / n + (R() - 0.5) * 0.18, top = tops[(i + t0) % 4] + (R() - 0.5) * 0.16, ph = R() * TAU, wob = 0.08 + 0.07 * R(), fr = 2.2 + R(), lean = (R() - 0.5) * 0.5;
      const at = (y) => x0 + lean * (y + 0.7) + wob * Math.sin(y * fr + ph);
      N.strokeStyle = '#4a5f2c'; N.lineWidth = 0.04; N.lineCap = 'round'; N.beginPath(); for (let y = -E; y <= top; y += 0.05) N[y === -E ? 'moveTo' : 'lineTo'](at(y), y); N.stroke();
      stems.push([at, top]);
    }
    N.fillStyle = '#1b2522'; N.fillRect(-E, -E, 2 * E, E - 0.7); N.fillStyle = 'rgba(150,175,150,0.45)'; N.fillRect(-E, -0.74, 2 * E, 0.04);
    for (const [at, top] of stems) {
      let side = R() < 0.5 ? 1 : -1;
      for (let y = -0.64; y <= top; y += 0.16 + 0.1 * R()) {
        const t = (y + 0.64) / (top + 0.64), s = 0.5 - 0.3 * t + 0.08 * R(); side = -side;
        leaf(N, at(y), y, s, s * (0.62 + 0.16 * R()), PI / 2 - side * (0.85 + 0.75 * R()), R, t * 14, 4 - 10 * t);
      }
    }
  },
  // HERBS IN ROWS: two troughs on the dark back, a row of tufts in each (broad-leaved, thin-bladed, small-leaved),
  // the lower row under its own pale strip beneath the upper trough
  herbs(N, F, R) {
    const g = F.createLinearGradient(0, E, 0, -E); g.addColorStop(0, '#2a3a31'); g.addColorStop(1, '#151e19');
    F.fillStyle = g; F.fillRect(-E, -E, 2 * E, 2 * E);
    const rows = [[-0.82, 0.7, 9], [0.14, 0.66, 4]];
    for (const [y, h, lift] of rows) {
      // (the shelf behind, the far tufts, then the near ones and the trough's front)
      F.fillStyle = '#3a4a42'; F.fillRect(-E, y - 0.26, 2 * E, 0.07);
      for (let x = -E + 0.1 * R(); x < E; x += 0.3 + 0.1 * R()) tuft(F, x, y + 0.02, h * (0.8 + 0.25 * R()), R, lift - 8, Math.floor(R() * 3));
      let k = Math.floor(R() * 3);
      for (let x = -E + 0.16 * R(); x < E + 0.2; x += 0.4 + 0.12 * R()) { tuft(N, x, y, h * (0.8 + 0.3 * R()), R, lift, k); k = (k + 1 + Math.floor(R() * 2)) % 3; }
      // (the trough's front is the pots' clay: a grey bar across the glass reads as a blind's slat)
      N.fillStyle = '#7d5c42'; N.fillRect(-E, y - 0.13, 2 * E, 0.13); N.fillStyle = '#a98360'; N.fillRect(-E, y - 0.035, 2 * E, 0.035);
    }
    F.fillStyle = '#e6dccf'; F.fillRect(-E, rows[1][0] - 0.185, 2 * E, 0.04);
  },
};

// ── the sheet ────────────────────────────────────────────────────────────────────────────────────────────────────
const DEC = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; DEC[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
const enc = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
// a picture (S x S, four numbers a pixel) blurred in place: three box blurs each way (edges held), near enough a
// Gaussian of `sigma` pixels
function blur(a, S, sigma) {
  if (sigma < 0.3) return a;
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2)), w = 2 * r + 1, b = new Float32Array(a.length);
  // (one pass along lines whose pixels are `step` apart in the array: 4 along x, 4 S along y)
  const pass = (src, dst, step, other) => {
    for (let l = 0; l < S; l++) for (let ch = 0; ch < 4; ch++) {
      const o = l * other + ch, last = o + (S - 1) * step; let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[o + Math.min(S - 1, Math.max(0, i)) * step];
      for (let i = 0; i < S; i++) { dst[o + i * step] = sum / w; const inn = i + r + 1, out = i - r; sum += src[inn < S ? o + inn * step : last] - src[out > 0 ? o + out * step : o]; }
    }
  };
  for (let n = 0; n < 3; n++) { pass(a, b, 4, 4 * S); pass(b, a, 4 * S, 4); }
  return a;
}
let SHEET = null;
function sheet() {
  if (SHEET) return SHEET;
  const w = Math.max(512, Math.round(GROW.sheet / 512) * 512), data = new Uint8Array(w * H * 4);
  // (until a kind is painted over it: a dim grey-green, in case a pod is shown before its picture is there)
  for (let i = 0; i < data.length; i += 4) { data[i] = 70; data[i + 1] = 96; data[i + 2] = 70; data[i + 3] = 255; }
  const tex = new THREE.DataTexture(data, w, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  SHEET = { w, data, tex, kinds: new Map(), most: 3 * w / 512 };
  return SHEET;
}
// a painted canvas as light (not screen values), its colours already times their cover
function lightOf(cv, S) {
  const d = cv.getContext('2d').getImageData(0, 0, S, S).data, a = new Float32Array(S * S * 4);
  for (let i = 0; i < d.length; i += 4) { const al = d[i + 3] / 255; a[i] = DEC[d[i]] * al; a[i + 1] = DEC[d[i + 1]] * al; a[i + 2] = DEC[d[i + 2]] * al; a[i + 3] = al; }
  return a;
}
// a picture (S x S) written to the sheet n x n, its bottom-left pixel at (ox, oy): each of the sheet's pixels the mean
// of the painted ones under it
function store(T, a, S, n, ox, oy) {
  const step = S / n, k = step * step, f = (v) => enc(Math.min(1, v / k));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let r = 0, g = 0, b = 0, al = 0;
    for (let j = 0; j < step; j++) for (let i = 0; i < step; i++) { const s = ((y * step + j) * S + x * step + i) << 2; r += a[s]; g += a[s + 1]; b += a[s + 2]; al += a[s + 3]; }
    const o = ((oy + n - 1 - y) * T.w + ox + x) << 2;   // (the canvas's rows run down, the sheet's up)
    T.data[o] = f(r); T.data[o + 1] = f(g); T.data[o + 2] = f(b); T.data[o + 3] = Math.round(255 * Math.min(1, al / k));
  }
}
function paint(T, plant, frost, seed, nx, ny, fx, fy) {
  const mk = (P) => { const cv = document.createElement('canvas'); cv.width = cv.height = P; const c = cv.getContext('2d', { willReadFrequently: true }); c.setTransform(P / (2 * E), 0, 0, -P / (2 * E), P / 2, P / 2); c.lineJoin = 'round'; return [cv, c]; };
  // (each painted at twice the size it is kept at, so the leaves' edges are clean before the blur)
  const PN = NEAR * 2, PF = FAR * 2, [cn, N] = mk(PN), [cf, F] = mk(PF), fr = FROST[frost];
  PAINT[plant](N, F, rand(seed * 7919 + PLANTS.indexOf(plant) * 131));
  store(T, blur(lightOf(cn, PN), PN, fr.near * PN / (2 * E)), PN, NEAR, nx, ny);
  store(T, blur(lightOf(cf, PF), PF, fr.far * PF / (2 * E)), PF, FAR, fx, fy);
  T.tex.needsUpdate = true;
}
// where a kind's two pictures are on the sheet: { near: [u, v], far: [u, v] } (each picture's bottom-left corner).
// The first time a kind is asked for it is given its place and painted.
export function podCell(plant = 'ring', frost = 'medium', seed = 1) {
  const T = sheet(), key = plant + '|' + frost + '|' + seed;
  let c = T.kinds.get(key); if (c) return c;
  if (!PAINT[plant]) throw new Error('kit: no grow pod planting "' + plant + '" (' + PLANTS.join(', ') + ')');
  if (!FROST[frost]) throw new Error('kit: no grow pod frost "' + frost + '" (' + Object.keys(FROST).join(', ') + ')');
  const n = T.kinds.size;
  if (n >= T.most) throw new Error('kit: the grow pods\' picture sheet is full (' + T.most + ' kinds of pod): raise GROW.sheet in kit/growglass.js');
  const bx = Math.floor(n / 3) * 512, i = n % 3, [nx, ny] = [[0, 0], [NEAR, 0], [0, NEAR]][i], [fx, fy] = [[NEAR, NEAR], [NEAR + FAR, NEAR], [NEAR, NEAR + FAR]][i];
  c = { near: [(bx + nx) / T.w, ny / H], far: [(bx + fx) / T.w, fy / H] };
  T.kinds.set(key, c);
  if (typeof document !== 'undefined') paint(T, plant, frost, seed, bx + nx, ny, bx + fx, fy);
  return c;
}
// the sheet itself (for a lab to show, or to count): { tex, w, h, kinds }
export const podSheet = () => { const T = sheet(); return { tex: T.tex, w: T.w, h: H, kinds: [...T.kinds.keys()] }; };

// ── the material ─────────────────────────────────────────────────────────────────────────────────────────────────
// What a pod's glass carries in each vertex (kit/shipparts/cabin/growpod.js fills them in):
//   uv      the place on the glass: -1 .. 1 across the opening, (0, 0) its middle
//   aCell   where its kind's pictures are on the sheet: the near one's u, v, the far one's u, v
//   aPod    the glass's half-size (metres), this pod's own brightness (1), its shape (0 eight-sided, 1 round), how deep
//           it is (1: GROW.near and GROW.far)
//   aLook   the frost's haze, its grain, 1 or -1 (-1: its picture mirrored), where in its movement it starts (0 .. 1)
//   aMove   how its picture is turned (radians), how fast it turns (radians a second: the plants go round; the lamp, the
//           glass and its grain stay still), how far its near leaves stir, how far its picture is shifted sideways (so
//           two pods of one kind do not match)
//   aLamp   the lamp: 0 a strip along the top or 1 a ring round the rim; its brightness (1); its colour (0 warm white
//           .. 1 pink-white); how lit the parts furthest from it are (0 .. 1)
// The eye's line is followed from the glass back into the pod: `near` behind the glass the near leaves, `far` behind it
// the pod's back (or, where the line leaves the pod's shape first, the pod's side wall).
// time: a { value } of seconds (the kit's U.time): all the movement there is comes from it, in the shader.
export function podGlass(time) {
  const T = sheet();
  const m = new THREE.ShaderMaterial({
    uniforms: { uSheet: { value: T.tex }, uTime: time || { value: 0 }, uGlow: UGLOW, uCell: { value: new THREE.Vector4(NEAR / T.w, NEAR / H, FAR / T.w, FAR / H) }, uDepth: { value: new THREE.Vector2(GROW.near, GROW.far) } },
    fog: false,
    vertexShader: `attribute vec4 aCell; attribute vec4 aPod; attribute vec4 aLook; attribute vec4 aMove; attribute vec4 aLamp;
varying vec2 vQ; varying vec3 vEye; varying vec4 vCell; varying vec4 vPod; varying vec4 vLook; varying vec4 vMove; varying vec4 vLamp;
void main() {
  vQ = uv; vCell = aCell; vPod = aPod; vLook = aLook; vMove = aMove; vLamp = aLamp;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  vec4 w = m * vec4( position, 1.0 );
  // the way to the eye, along the glass's own right, up and out
  vec3 n = normalize( mat3( m ) * normal ), r = abs( n.y ) > 0.95 ? vec3( 1.0, 0.0, 0.0 ) : normalize( cross( vec3( 0.0, 1.0, 0.0 ), n ) ), u = cross( n, r ), e = cameraPosition - w.xyz;
  vEye = vec3( dot( e, r ), dot( e, u ), dot( e, n ) );
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform sampler2D uSheet; uniform float uTime; uniform float uGlow; uniform vec4 uCell; uniform vec2 uDepth;
varying vec2 vQ; varying vec3 vEye; varying vec4 vCell; varying vec4 vPod; varying vec4 vLook; varying vec4 vMove; varying vec4 vLamp;
#include <common>
const float REACH = ${E.toFixed(3)};               // (a picture reaches this many half-sizes out from the glass's middle)
const vec3 MILK = vec3( 0.25, 0.33, 0.26 );  // the frost itself, lit from inside
const float SAG = ${GROW.sag.toFixed(3)};                 // (how far a turning pod's plants hang at the pod's middle, half-sizes)
// how far out a place on the glass is: 1 on the opening's edge (eight-sided, or round)
float podEdge( vec2 q, float rnd ) { vec2 a = abs( q ); return mix( max( max( a.x, a.y ), ( a.x + a.y ) * 0.70710678 ), length( q ), rnd ); }
// how lit a place in the pod is: 1 by the lamp (a strip along the top, or a ring round the rim), lamp.w furthest from it
float podLit( vec2 q, float d, vec4 lamp ) { float k = mix( smoothstep( -1.1, 0.75, q.y ), smoothstep( -0.6, 0.95, d ), lamp.x ); return lamp.w + ( 1.0 - lamp.w ) * k * sqrt( k ); }
vec2 podTurn( vec2 q, float a ) { float c = cos( a ), s = sin( a ); return vec2( c * q.x - s * q.y, s * q.x + c * q.y ); }
vec4 podPic( vec2 q, vec2 at, vec2 size ) { return texture2D( uSheet, at + clamp( q / ( 2.0 * REACH ) + 0.5, 0.02, 0.98 ) * size ); }
float podHash( vec2 p ) { p = fract( p * vec2( 0.1031, 0.103 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }
float podGrain( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( podHash( i ), podHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( podHash( i + vec2( 0.0, 1.0 ) ), podHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
void main() {
  float hs = vPod.x, rnd = vPod.z, t = uTime + vLook.w * 100.0, ang = vMove.x + t * vMove.y;
  vec3 eye = normalize( vEye );
  vec2 lean = eye.xy / max( eye.z, 0.3 ) * vPod.w / hs;
  float d0 = podEdge( vQ, rnd );
  vec3 milk = MILK * ( 0.3 + 0.7 * podLit( vQ, d0, vLamp ) );
  // the back: where the eye's line ends on it, or (past its edge) where the line meets the pod's side wall on the way
  vec2 qf = vQ - lean * uDepth.y; float df = podEdge( qf, rnd ), side = smoothstep( 1.0, 1.03, df ), s = clamp( ( 1.0 - d0 ) / max( df - d0, 1e-4 ), 0.0, 1.0 );
  qf = mix( qf, vQ + ( qf - vQ ) * s, side ); df = min( df, 1.0 );
  vec2 qn = vQ - lean * uDepth.x; float dn = podEdge( qn, rnd );
  // stirring leaves sway sideways (hardly up and down: a trough's edge stays put)
  vec2 stir = vMove.z * vec2( sin( t * 1.1 + qn.y * 3.1 + qn.x * 1.3 ), 0.25 * cos( t * 0.9 + qn.x * 2.7 ) ), flip = vec2( vLook.z, 1.0 ), shift = vec2( vMove.w, 0.0 );
  // a turning pod's plants HANG: each one's tip sags toward the pod's floor wherever on the wheel it is (its root, on
  // the rim, does not), so a plant changes shape all the way round and is not a picture spun on a pin
  float hang = SAG * step( 1e-5, abs( vMove.y ) );
  vec2 qfs = qf + vec2( 0.0, hang * 0.6 * ( 1.0 - df * df ) ), qns = qn + vec2( 0.0, hang * ( 1.0 - min( dn, 1.0 ) * min( dn, 1.0 ) ) );
  vec3 back = podPic( podTurn( qfs * flip + shift, ang ), vCell.zw, uCell.zw ).rgb * podLit( qf, df, vLamp );
  // the lamp itself (soft through the frost; it does not turn): a strip on the pod's back, along its top
  float soft = 0.05 + 0.28 * vLook.x;
  vec2 lb = vec2( max( abs( qf.x ) - 0.5, 0.0 ), qf.y - 0.72 );
  vec3 lamp = mix( vec3( 1.0, 0.86, 0.68 ), vec3( 1.0, 0.68, 0.84 ), vLamp.z ) * 0.72 * vLamp.y;
  back = mix( back, lamp, ( 1.0 - smoothstep( 0.035, 0.035 + soft, length( lb ) ) ) * ( 1.0 - vLamp.x ) );
  // (the pod's own side wall, where the eye's line meets it before the back: dim, dimmer further in)
  back = mix( back, milk * ( 0.3 - 0.18 * s ), side );
  // the near leaves stop at the pod's side wall. Seen from the side that edge shows on the glass's far side: there
  // they thin out toward the wall over a few times the shift (a hard cut reads as the edge of a picture); seen from
  // straight in front nothing changes
  float thin = clamp( -dot( qn, lean ) * uDepth.x * 2.5, 0.0, 0.45 );
  vec4 front = podPic( podTurn( qns * flip + shift, ang ) + stir, vCell.xy, uCell.xy ) * ( 1.0 - smoothstep( 0.97 - thin, 1.03, dn ) );
  vec3 col = front.rgb * podLit( qn, min( dn, 1.0 ), vLamp ) + back * ( 1.0 - front.a );
  // the lamp's glow in the frost round it
  col += lamp * mix( exp( -5.0 * length( lb ) ), 0.7 * exp( -7.0 * abs( d0 - 0.93 ) ), vLamp.x ) * ( 0.08 + 0.6 * vLook.x );
  // the frost: its haze (thicker seen from the side) and its grain (gone by the time a grain is smaller than a pixel)
  float haze = vLook.x + ( 1.0 - vLook.x ) * 0.5 * pow( 1.0 - eye.z, 3.0 );
  col = mix( col, milk, haze );
  vec2 pm = vQ * hs / 0.0012; float fw = max( fwidth( pm.x ), fwidth( pm.y ) );
  col *= 1.0 + ( podGrain( pm ) - 0.5 ) * 2.0 * vLook.y * clamp( 1.3 - fw, 0.0, 1.0 );
  // the shadow under the frame's rim; then a lamp round the rim: one unbroken line of light just inside the frame, in
  // front of the plants
  col *= 1.0 - 0.4 * smoothstep( 0.86, 1.0, d0 );
  col = mix( col, lamp * 0.55, ( 1.0 - smoothstep( 0.006, 0.006 + soft * 0.3, abs( d0 - 0.93 ) ) ) * vLamp.x );
  // a soft sheen across the glass, sliding as the eye moves (the room in the glass)
  float sheen = ( vQ.y - 0.8 * vQ.x - 0.55 + 1.2 * eye.x - 0.6 * eye.y ) / 0.3;
  col += vec3( 0.75, 0.88, 1.0 ) * 0.04 * exp( -sheen * sheen ) * ( 1.0 - smoothstep( 0.85, 1.0, d0 ) );
  gl_FragColor = vec4( col * uGlow * vPod.y, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  m.extensions.derivatives = true;   // (fwidth, on WebGL 1)
  return m;
}

// ── REAL PLANTS (the planting 'carousel': kit/shipparts/cabin/growpod.js builds them) ──────────────────────────────
// The game's maker, 2026-11-10: "is it just a picture? I think it would be cool if the plants were 3d and it looked like
// the leaves had some depth." A carousel pod is not a picture: its plants are real leaves, stems, pots and fruit (a few
// hundred triangles a plant) standing on a turntable with an upright axle, in a chamber behind the glass, and its glass
// is a lightly frosted pane in front of them. Two materials, so ALL the carousel pods in a room's batch are two draws:
//   podInside(time)   the chamber and everything in it (solid). The turntable and its plants go round on the graphics
//                     card, from the one clock: nothing is done for it each frame.
//   podPane()         the frosted pane (see-through, drawn after): a milky haze, its fine grain, the lamp's glow in it,
//                     a shadow under the frame's rim and a faint sheen
// THE DEPTH IS REAL. The chamber goes back behind the wall's face (a little deeper than the glass is wide), so as the eye
// moves the plants slide past one another and behind the frame as real things do. The wall does not hide them: each
// corner of them is moved along the eye's own line (which leaves it on the same spot of the screen) into a thin layer
// just behind the glass, in front of the wall's face, their order kept; and only what is seen through the opening is
// drawn. What stands in front of the pod (its frame, a coffee maker) still hides them.
// Further in, the chamber's own haze takes more of them: near plants clearer, far ones softer and dimmer.
// What each corner of the inside carries (growpod.js fills them in):
//   normal   the pod's facing (its glass's outward normal: placed with the piece, so it turns with it)
//   aLocal   where it is in the pod's own frame (metres: x right, y up, z out of the glass; the glass's middle is 0),
//            and what it is: 0 still (the chamber, the axle), 1 turning (the turntable and the plants), 2 the lamp
//   aCol     its colour (linear) and 1 for a leaf (lit from either side: thin, light comes through it)
//   aPod     the glass's half-size, its shape (0 eight-sided, 1 round), how fast it turns (radians a second), where in
//            its turn it starts
//   aLamp    the lamp's colour (0 warm white .. 1 pink-white), the lamp's brightness (1), the pod's own brightness (1),
//            how lit the places furthest from the lamp are
// The chamber's sizes, in half-sizes of the glass (growpod.js builds to them; the glass lights and fogs by them):
//   ring     how far out on the turntable the plants stand (past the glass's edge: they go out of sight at the sides)
//   table    the turntable's radius, its top's height (tableY) and how far in its axle is (axle)
//   wide, top, floor, back   the chamber's half-width, its ceiling, its floor and how deep its back wall is
//   lamp     the lamp bar across the top: its half-length, height and depth
//   fog      how much haze a half-size further in adds, and the most there is (fogMost)
export const INSIDE = { ring: 1.0, table: 1.22, tableY: -0.72, axle: 1.32, wide: 1.34, top: 1.12, floor: -1.06, back: 2.66, lamp: [0.75, 0.82, -0.3], fog: 0.24, fogMost: 0.62 };
const f3 = (v) => v.toFixed(4);
const PODEDGE = 'float podEdge( vec2 q, float rnd ) { vec2 a = abs( q ); return mix( max( max( a.x, a.y ), ( a.x + a.y ) * 0.70710678 ), length( q ), rnd ); }';
const LAMPCOL = 'vec3 podLampCol( float tint ) { return mix( vec3( 1.0, 0.86, 0.68 ), vec3( 1.0, 0.68, 0.84 ), tint ); }';
export function podInside(time) {
  const I = INSIDE, L = I.lamp;
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: time || { value: 0 }, uGlow: UGLOW },
    fog: false, side: THREE.DoubleSide,
    vertexShader: `attribute vec4 aLocal; attribute vec4 aCol; attribute vec4 aPod; attribute vec4 aLamp;
uniform float uTime;
varying vec3 vW; varying vec3 vG; varying vec3 vF; varying vec4 vCol; varying vec4 vPod; varying vec4 vLamp; varying float vKind;
void main() {
  vCol = aCol; vPod = aPod; vLamp = aLamp; vKind = aLocal.w;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  // the pod's own frame in the piece (its facing is the normal), and the glass's middle
  vec3 f = normalize( normal ), r = normalize( cross( vec3( 0.0, 1.0, 0.0 ), f ) ), u = cross( f, r );
  vec3 g = position - ( r * aLocal.x + u * aLocal.y + f * aLocal.z );
  // the turntable and its plants go round the upright axle
  float hs = aPod.x, a = ( aPod.w + uTime * aPod.z ) * step( 0.5, aLocal.w ) * step( aLocal.w, 1.5 ), c = cos( a ), s = sin( a ), za = -${f3(I.axle)} * hs;
  vec3 q = aLocal.xyz; vec2 o = vec2( q.x, q.z - za );
  q.x = o.x * c + o.y * s; q.z = o.y * c - o.x * s + za;
  vec4 w = m * vec4( g + r * q.x + u * q.y + f * q.z, 1.0 );
  vec3 gw = ( m * vec4( g, 1.0 ) ).xyz, fw = normalize( mat3( m ) * f );
  vW = w.xyz; vG = gw; vF = fw;
  // its depth on the screen: along the eye's line to a thin layer 0.8 to 3.4 mm behind the glass, its order kept
  float hc = dot( cameraPosition - gw, fw ), h = -dot( w.xyz - gw, fw );
  float h2 = 0.0008 + 0.0026 * clamp( h / ( ${f3(I.back + 0.1)} * hs ), 0.0, 1.0 );
  vec3 wc = cameraPosition + ( w.xyz - cameraPosition ) * ( ( hc + h2 ) / max( hc + h, 1e-5 ) );
  // (seen from behind the glass's plane: nothing)
  gl_Position = hc > 0.002 ? projectionMatrix * viewMatrix * vec4( wc, 1.0 ) : vec4( 0.0, 0.0, 2.0, 1.0 );
}`,
    fragmentShader: `uniform float uGlow;
varying vec3 vW; varying vec3 vG; varying vec3 vF; varying vec4 vCol; varying vec4 vPod; varying vec4 vLamp; varying float vKind;
#include <common>
const vec3 MILK = vec3( 0.25, 0.33, 0.26 );
${PODEDGE}
${LAMPCOL}
void main() {
  float hs = vPod.x;
  vec3 r = normalize( cross( vec3( 0.0, 1.0, 0.0 ), vF ) ), u = cross( vF, r );
  // only what is seen through the opening: where the eye's line crosses the glass
  float hc = dot( cameraPosition - vG, vF ), h = -dot( vW - vG, vF );
  vec3 x = cameraPosition + ( vW - cameraPosition ) * ( hc / max( hc + h, 1e-5 ) ) - vG;
  if ( podEdge( vec2( dot( x, r ), dot( x, u ) ) / hs, vPod.y ) > 1.02 ) discard;
  // the place in the pod (half-sizes), and the facet's own facing (toward the eye)
  vec3 d = vW - vG, lp = vec3( dot( d, r ), dot( d, u ), dot( d, vF ) ) / hs;
  vec3 n = normalize( cross( dFdx( vW ), dFdy( vW ) ) ); n = dot( n, cameraPosition - vW ) < 0.0 ? -n : n;
  vec3 nl = vec3( dot( n, r ), dot( n, u ), dot( n, vF ) );
  // the lamp: a bar across the top near the front. Lit by how near it is and how a facet faces it (a leaf from either
  // side, less through it)
  vec3 lampCol = podLampCol( vLamp.x );
  vec3 lc = vec3( clamp( lp.x, -${f3(L[0])}, ${f3(L[0])} ), ${f3(L[1])}, ${f3(L[2])} ) - lp; float dist = max( length( lc ), 1e-4 );
  float dl = dot( nl, lc / dist ), face = mix( max( dl, 0.0 ), dl > 0.0 ? dl : -0.55 * dl, vCol.w );
  float near = 1.0 / ( 1.0 + 1.4 * dist * dist );
  float lit = vLamp.w + ( 1.0 - vLamp.w ) * near * ( 0.3 + 0.7 * face );
  vec3 col = vCol.rgb * lit * mix( vec3( 1.0 ), lampCol, 0.3 ) * 1.6;
  // soft ribs up the chamber's back
  col *= 1.0 + 0.6 * step( vKind, 0.5 ) * step( lp.z, -${f3(I.back - 0.05)} ) * pow( 0.5 + 0.5 * cos( lp.x * 12.0 ), 6.0 );
  // the lamp itself (never as bright as white)
  col = mix( col, lampCol * 0.72 * vLamp.y, step( 1.5, vKind ) );
  // the chamber's haze: more of it the further in
  float fog = min( ${f3(I.fogMost)}, ${f3(I.fog)} * max( -lp.z - 0.15, 0.0 ) ) * step( vKind, 1.5 );
  col = mix( col, MILK * 0.16 * mix( vec3( 1.0 ), lampCol, 0.25 ), fog );
  gl_FragColor = vec4( col * uGlow * vLamp.z, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  m.extensions.derivatives = true;   // (dFdx, on WebGL 1)
  return m;
}
// the frosted pane in front of a carousel's plants. Its corners carry what a picture pod's glass does (aPod: the glass's
// half-size, the pod's brightness, its shape; aLook: the frost's haze and grain; aLamp: 0, the lamp's brightness and
// colour, how lit the furthest places are)
export function podPane() {
  const L = INSIDE.lamp;
  const m = new THREE.ShaderMaterial({
    uniforms: { uGlow: UGLOW },
    fog: false, transparent: true, depthWrite: false, premultipliedAlpha: true,
    vertexShader: `attribute vec4 aPod; attribute vec4 aLook; attribute vec4 aLamp;
varying vec2 vQ; varying vec3 vEye; varying vec4 vPod; varying vec4 vLook; varying vec4 vLamp;
void main() {
  vQ = uv; vPod = aPod; vLook = aLook; vLamp = aLamp;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  vec4 w = m * vec4( position, 1.0 );
  vec3 n = normalize( mat3( m ) * normal ), r = abs( n.y ) > 0.95 ? vec3( 1.0, 0.0, 0.0 ) : normalize( cross( vec3( 0.0, 1.0, 0.0 ), n ) ), u = cross( n, r ), e = cameraPosition - w.xyz;
  vEye = vec3( dot( e, r ), dot( e, u ), dot( e, n ) );
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uGlow;
varying vec2 vQ; varying vec3 vEye; varying vec4 vPod; varying vec4 vLook; varying vec4 vLamp;
#include <common>
const vec3 MILK = vec3( 0.25, 0.33, 0.26 );
${PODEDGE}
${LAMPCOL}
float podHash( vec2 p ) { p = fract( p * vec2( 0.1031, 0.103 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }
float podGrain( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( podHash( i ), podHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( podHash( i + vec2( 0.0, 1.0 ) ), podHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
void main() {
  float hs = vPod.x, d0 = podEdge( vQ, vPod.z );
  vec3 eye = normalize( vEye ), lampCol = podLampCol( vLamp.z ) * vLamp.y;
  // the lamp bar as the eye sees it through the glass: where the lines to its two ends cross the glass
  vec3 cam = vec3( vQ * hs, 0.0 ) + vEye, b0 = vec3( -${f3(L[0])}, ${f3(L[1])}, ${f3(L[2])} ) * hs, b1 = vec3( ${f3(L[0])}, ${f3(L[1])}, ${f3(L[2])} ) * hs;
  vec2 p0 = ( cam + ( b0 - cam ) * ( cam.z / ( cam.z - b0.z ) ) ).xy / hs, p1 = ( cam + ( b1 - cam ) * ( cam.z / ( cam.z - b1.z ) ) ).xy / hs;
  vec2 pa = vQ - p0, ba = p1 - p0; float dlamp = length( pa - ba * clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 ) );
  // the frost: a light milky haze (thicker seen from the side), with its fine grain (gone once a grain is under a pixel)
  float haze = 0.03 + 0.75 * vLook.x + ( 1.0 - vLook.x ) * 0.45 * pow( 1.0 - eye.z, 3.0 );
  vec2 pm = vQ * hs / 0.0012; float fw = max( fwidth( pm.x ), fwidth( pm.y ) );
  haze = clamp( haze * ( 1.0 + ( podGrain( pm ) - 0.5 ) * 2.2 * vLook.y * clamp( 1.3 - fw, 0.0, 1.0 ) ), 0.0, 1.0 );
  float lit = smoothstep( -1.1, 0.75, vQ.y ), k = vLamp.w + ( 1.0 - vLamp.w ) * lit * sqrt( lit );
  vec3 col = MILK * ( 0.3 + 0.7 * k ) * haze + lampCol * exp( -6.0 * dlamp ) * ( 0.05 + 0.5 * vLook.x );
  // the shadow under the frame's rim, then a faint sheen sliding as the eye moves
  float sh = 0.4 * smoothstep( 0.86, 1.0, d0 ); col *= 1.0 - sh;
  float sheen = ( vQ.y - 0.8 * vQ.x - 0.55 + 1.2 * eye.x - 0.6 * eye.y ) / 0.3;
  col += vec3( 0.75, 0.88, 1.0 ) * 0.04 * exp( -sheen * sheen ) * ( 1.0 - smoothstep( 0.85, 1.0, d0 ) );
  gl_FragColor = vec4( col * uGlow * vPod.y, 1.0 - ( 1.0 - haze ) * ( 1.0 - sh ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  m.extensions.derivatives = true;   // (fwidth, on WebGL 1)
  return m;
}
