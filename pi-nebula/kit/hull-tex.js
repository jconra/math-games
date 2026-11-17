// THE HULL'S PICTURES, drawn in code once (as kit/tex.js draws the station's): a tiling patch 4 m square for each metal
// FINISH and one for the WEAR. A picture is plain numbers (a square of red, green, blue and alpha, 0 to 255) that
// kit/hull.js hands to the graphics card; what each channel means:
//   a finish   R  lighter and darker (128: neither)        G  shinier and rougher (128: neither)
//              B  heat (tempered only): 0 none, rising through straw, bronze and purple to blue
//   the wear   R  scratches and scuffs                     G  slow smudges (grime gathers by them, worn edges break up by them)
//              B  meteoroid pits: 128 none, darker a pit, lighter its rim; a stronger pit shows at a lower setting
//              A  streaks, running down
// Each finish is drawn the way the thing itself is made: BRUSHED is fine streaks all one way; CROSS-HATCHED
// is two sets of cut lines at right angles; TEMPERED is patches of heat; MOTTLED is the hangar floor's soft blotches
// (kit/tex.js floorAtlas's grime); PLAIN is only a fine grain. Everything tiles, so the patch repeats without a join.
// (Strokes are drawn on a canvas, so this file needs a browser; the rest is sums over the pixels.)
export const TILE = 4;                 // metres a patch covers
export const BRUSH = { along: 4, across: 1 };   // the brushed picture: metres along the brushing, metres across it
export const HATCH_CELLS = 8;          // the cross-hatched picture: squares across it each way
// how a finish's picture is laid on a plate: [a, b, c, d], the picture's u = a * x + b * y, its v = c * x + d * y, for a
// point x metres along the hull and y up the plate
export function finishLay(kind, angle = 0, spacing = 0.16) {
  const t = angle * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  if (kind === 'brushed') return [c / BRUSH.along, s / BRUSH.along, -s / BRUSH.across, c / BRUSH.across];
  if (kind === 'hatched') { const k = 1 / (HATCH_CELLS * Math.max(0.01, spacing)); return [c * k, s * k, -s * k, c * k]; }
  return [1 / TILE, 0, 0, 1 / TILE];
}

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// tiling value noise: cx by cy lattice squares across the square, smoothly blended
function valueNoise(size, cx, cy, seed) {
  const R = rng(seed), lat = new Float32Array(cx * cy).map(() => R()), out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * cx, fy = y / size * cy, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (ix + 1) % cx, y1 = (iy + 1) % cy;
    const a = lat[iy * cx + ix], b = lat[iy * cx + x1], c = lat[y1 * cx + ix], d = lat[y1 * cx + x1];
    out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  return out;
}
function fbm(size, base, oct, seed) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { const n = valueNoise(size, base << o, base << o, seed + o * 101); for (let i = 0; i < n.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
const canvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// a stroke drawn so the patch tiles: again one patch over wherever it crosses an edge
function wrapped(g, size, x, y, ex, ey) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    if (x + ox + Math.max(0, ex) < -3 || x + ox + Math.min(0, ex) > size + 3 || y + oy + Math.max(0, ey) < -3 || y + oy + Math.min(0, ey) > size + 3) continue;
    g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + ex, y + oy + ey); g.stroke();
  }
}
// one channel of a canvas as numbers 0 to 1
function channel(c, k = 0) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height); for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + k] / 255; return out; }
// spread a channel so it sits round 0.5 with a set contrast
function level(a, spread) {
  let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length;
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); s = Math.sqrt(s / a.length) || 1;
  for (let i = 0; i < a.length; i++) a[i] = clamp01(0.5 + (a[i] - m) / s * spread);
  return a;
}

// ── A FINISH ────────────────────────────────────────────────────────────────────────────────────────────────────
//   kind     plain | brushed | tempered | hatched | mottled
//   o        { size (pixels across, 512), seed }
// Returns { data, size }. Plain, tempered and mottled cover TILE metres square. Brushed and cross-hatched are drawn
// one way only and laid on the plate turned and sized by the material (finishLay below), so changing the brushing's
// direction, or the cut lines' angle and spacing, never draws a picture again.
export function finishPixels(kind, o = {}) {
  const size = o.size || 512, N = size * size, px = size / TILE, seed = o.seed || 3;
  const light = new Float32Array(N).fill(0.5), rough = new Float32Array(N).fill(0.5), heat = new Float32Array(N);
  const grain = valueNoise(size, size >> 1, size >> 1, seed + 91);
  if (kind === 'brushed') {
    // fine lines all one way: streaks of many widths and lengths, the finest a pixel wide. They run along the picture
    // (the material turns it to the direction asked for), and the picture is not square on the plate: it covers
    // BRUSH.along metres along the brushing and BRUSH.across across it, so the lines stay fine up close
    const s = new Float32Array(N);
    for (const [cx, cy, k] of [[5, size, 0.5], [12, size >> 1, 0.4], [3, size >> 3, 0.3], [2, 14, 0.22]]) { const n = valueNoise(size, cx, cy, seed + cx * 7 + cy); for (let i = 0; i < N; i++) s[i] += (n[i] - 0.5) * k; }
    level(s, 0.17);
    for (let i = 0; i < N; i++) { light[i] = s[i]; rough[i] = 1 - s[i]; }
  } else if (kind === 'hatched') {
    // two sets of cut lines at right angles, HATCH_CELLS squares across the picture each way (the material sizes and
    // turns the picture to the spacing and the angle asked for): each line a dark groove with a pale shoulder; the
    // squares between differ a little
    const gw = 0.065;                    // (half a groove's width, as a part of a square)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let l = 0.5, r = 0.5;
      for (const ph of [x / size * HATCH_CELLS, y / size * HATCH_CELLS]) {
        const f = ph - Math.floor(ph), d = Math.min(f, 1 - f);
        const groove = Math.exp(-(d * d) / (gw * gw)), lip = Math.exp(-((d - 2.2 * gw) * (d - 2.2 * gw)) / (gw * gw));
        l += -0.42 * groove + 0.16 * lip; r += 0.34 * groove - 0.1 * lip;
      }
      const id = Math.floor(x / size * HATCH_CELLS) * 17 + Math.floor(y / size * HATCH_CELLS) * 5 + 3, h = Math.sin(id * 12.9898) * 43758.5453;
      light[y * size + x] = clamp01(l + ((h - Math.floor(h)) - 0.5) * 0.07); rough[y * size + x] = clamp01(r);
    }
  } else if (kind === 'mottled') {
    // the hangar floor's look: soft dark blotches of many sizes over the plate, a few paler ones, slow changes under them
    const c = canvas(size), g = c.getContext('2d'), R = rng(seed + 11);
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 300; i++) {
      const x = R() * size, y = R() * size, r = (0.09 + R() * R() * 0.55) * px, dark = R() < 0.78, al = (dark ? 0.4 : 0.24) * R();
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        if (x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size) continue;
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r), v = dark ? 20 : 235;
        gr.addColorStop(0, `rgba(${v},${v},${v},${al})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    const s = channel(c), slow = fbm(size, 3, 3, seed + 17);
    // (a faint level grain under them, as the hangar's plain deck has)
    const lines = valueNoise(size, 4, size >> 1, seed + 19);
    for (let i = 0; i < N; i++) { const v = clamp01(s[i] + (slow[i] - 0.5) * 0.3 + (lines[i] - 0.5) * 0.07); light[i] = v; rough[i] = clamp01(0.5 + (0.5 - v) * 1.1); }
  } else if (kind === 'tempered') {
    // patches of heat: none between them, rising toward each patch's middle (the colours come from that rise)
    const f = fbm(size, 3, 4, seed + 23), f2 = fbm(size, 7, 3, seed + 29);
    for (let i = 0; i < N; i++) { const h = smooth(0.5, 0.9, f[i] + (f2[i] - 0.5) * 0.25); heat[i] = h; light[i] = 0.5 - 0.05 * h + (f2[i] - 0.5) * 0.08; rough[i] = 0.5 - 0.16 * h; }
  }
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4] = Math.round(clamp01(light[i] + (grain[i] - 0.5) * 0.06) * 255); data[i * 4 + 1] = Math.round(clamp01(rough[i] + (grain[i] - 0.5) * 0.05) * 255);
    data[i * 4 + 2] = Math.round(heat[i] * 255); data[i * 4 + 3] = 255;
  }
  return { data, size };
}

// ── THE WEAR ────────────────────────────────────────────────────────────────────────────────────────────────────
export function wearPixels(o = {}) {
  const size = o.size || 512, N = size * size, px = size / TILE, seed = o.seed || 7;
  // scratches and scuffs: short strokes, mostly level, a few any way; here and there a scuff of several side by side
  const c = canvas(size), g = c.getContext('2d'), R = rng(seed + 3);
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size); g.lineCap = 'round';
  for (let i = 0; i < 620; i++) {
    const len = (0.04 + R() * R() * 0.7) * px, a = (R() - 0.5) * (R() < 0.8 ? 0.5 : 3.1);
    g.strokeStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; g.lineWidth = 0.7 + R() * 1.3;
    wrapped(g, size, R() * size, R() * size, Math.cos(a) * len, Math.sin(a) * len);
  }
  for (let i = 0; i < 46; i++) {
    const x = R() * size, y = R() * size, a = (R() - 0.5) * 1.2, len = (0.1 + R() * 0.35) * px, n = 4 + Math.floor(R() * 7);
    for (let k = 0; k < n; k++) {
      g.strokeStyle = `rgba(255,255,255,${0.12 + R() * 0.3})`; g.lineWidth = 0.8 + R() * 1.6;
      wrapped(g, size, x - Math.sin(a) * k * 2.2 + (R() - 0.5) * 6, y + Math.cos(a) * k * 2.2 + (R() - 0.5) * 6, Math.cos(a) * len * (0.6 + R() * 0.6), Math.sin(a) * len * (0.6 + R() * 0.6));
    }
  }
  const scratch = channel(c), smudge = fbm(size, 4, 4, seed);
  // streaks: narrow columns, each with its own strength, changing slowly along their length
  const s1 = valueNoise(size, 110, 3, seed + 41), s2 = valueNoise(size, 44, 2, seed + 43);
  // pits: a dark middle, a bright rim; each has a strength, and the stronger ones show first
  const pit = new Float32Array(N), P = rng(seed + 61);
  for (let i = 0; i < 300; i++) {
    const cx = P() * size, cy = P() * size, r = (0.011 + P() * P() * 0.04) * px, m = 0.12 + 0.88 * P(), reach = Math.ceil(r * 1.9);
    for (let yy = -reach; yy <= reach; yy++) for (let xx = -reach; xx <= reach; xx++) {
      const X = Math.round(cx) + xx, Y = Math.round(cy) + yy, d = Math.hypot(X - cx, Y - cy);
      let v = 0;
      if (d < r) v = -m * (1 - smooth(r * 0.55, r, d) * 0.6);
      else if (d < r * 1.9) v = m * Math.max(0, 1 - Math.abs(d - r * 1.3) / (r * 0.5));
      const k = (((Y % size) + size) % size) * size + (((X % size) + size) % size);
      if (Math.abs(v) > Math.abs(pit[k])) pit[k] = v;
    }
  }
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4] = Math.round(scratch[i] * 255);
    data[i * 4 + 1] = Math.round(clamp01((smudge[i] - 0.5) * 2.4 + 0.5) * 255);
    data[i * 4 + 2] = Math.round((0.5 + 0.5 * pit[i]) * 255);
    data[i * 4 + 3] = Math.round(clamp01(s1[i] * 0.7 + s2[i] * 0.3) * 255);
  }
  return { data, size };
}
