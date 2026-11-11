// TEXTURES for the station kit, all drawn in code (canvas), nothing downloaded:
//   wear    a tiling 2 m patch for the painted panels: R smudges, G scuffs and scratches, B fine grain
//   floor   one atlas for every floor tile (colour, roughness, bumps): tread plate, walkway grating, vent plate, plain
//           deck, each a 2 x 2 m square
//   decal   stencil labels, breaker labels, hazard stripes (white on clear, tinted by the piece)
//   screen  the glowing blue screens (a math station, a status board, a terminal, a radar)
// (the sky outside the windows is world/sky.js)
import * as THREE from 'three';
import { cabinPrint } from './shipparts/cabin/print.js';

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// tiling value noise: `cells` lattice squares across the square, smoothly blended
function valueNoise(size, cells, seed) {
  const R = rng(seed), lat = new Float32Array(cells * cells).map(() => R()), out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (ix + 1) % cells, y1 = (iy + 1) % cells;
    const a = lat[iy * cells + ix], b = lat[iy * cells + x1], c = lat[y1 * cells + ix], d = lat[y1 * cells + x1];
    out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  return out;
}
function fbm(size, base, oct, seed) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { const n = valueNoise(size, base << o, seed + o * 101); for (let i = 0; i < n.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
const tex = (c, srgb, rep = true) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; return t; };

// ── wear: a 2 m tiling patch ──────────────────────────────────────────────────────────────────────────────────────
export function wearTexture(size = 512, seed = 7) {
  const smudge = fbm(size, 4, 4, seed), grain = valueNoise(size, 128, seed + 9);
  // scuffs and scratches: short strokes, mostly level, drawn wrapped so the patch tiles
  const sc = canvas(size), g = sc.getContext('2d'), R = rng(seed + 3);
  g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const x = R() * size, y = R() * size, len = 3 + R() * R() * 34, a = (R() - 0.5) * (R() < 0.8 ? 0.5 : 3), w = 0.6 + R() * 1.6;
    g.strokeStyle = `rgba(255,255,255,${0.15 + R() * 0.5})`; g.lineWidth = w;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke(); }
  }
  // a few faint drips down from smudges
  for (let i = 0; i < 26; i++) { const x = R() * size, y = R() * size, len = 20 + R() * 80; g.strokeStyle = `rgba(255,255,255,${0.08 + R() * 0.12})`; g.lineWidth = 1 + R() * 2.5; for (const oy of [-size, 0, size]) { g.beginPath(); g.moveTo(x, y + oy); g.lineTo(x + (R() - 0.5) * 4, y + oy + len); g.stroke(); } }
  const sd = g.getImageData(0, 0, size, size).data, c = canvas(size), cg = c.getContext('2d'), img = cg.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) {
    const s = Math.max(0, Math.min(1, (smudge[i] - 0.52) * 3.2));
    d[i * 4] = s * 255; d[i * 4 + 1] = sd[i * 4 + 3]; d[i * 4 + 2] = grain[i] * 255; d[i * 4 + 3] = 255;
  }
  cg.putImageData(img, 0, 0); return tex(c, false);
}

// ── the floor atlas ───────────────────────────────────────────────────────────────────────────────────────────────
// each region is 512 px for 2 m (256 px a metre). The UV rects the floor tiles use, [u0, v0, u1, v1]:
export const FLOOR_RECT = { tread: [0, 0.5, 0.5, 1], grating: [0.5, 0.5, 1, 1], vent: [0, 0, 0.5, 0.5], deck: [0.5, 0, 1, 0.5] };
export function floorAtlas(seed = 11) {
  const S = 1024, H = 512, px = 256;
  const col = canvas(S), cg = col.getContext('2d'), hgt = canvas(S), hg = hgt.getContext('2d'), rgh = canvas(S), rg = rgh.getContext('2d');
  const R = rng(seed);
  // (canvas y runs down; a region's rect in uv has v up, so region (cx, cy) in canvas pixels is the uv rect flipped)
  const region = (cx, cy, fn) => { for (const g of [cg, hg, rg]) { g.save(); g.beginPath(); g.rect(cx, cy, H, H); g.clip(); g.translate(cx, cy); } fn(); for (const g of [cg, hg, rg]) g.restore(); };
  const both = (x, y, w, h, c, hv, rv) => { cg.fillStyle = c; cg.fillRect(x, y, w, h); if (hv != null) { hg.fillStyle = `rgb(${hv},${hv},${hv})`; hg.fillRect(x, y, w, h); } if (rv != null) { rg.fillStyle = `rgb(0,${rv},0)`; rg.fillRect(x, y, w, h); } };
  const dot = (x, y, r, c, hv, rv) => { for (const [g, s] of [[cg, c], [hg, `rgb(${hv},${hv},${hv})`], [rg, `rgb(0,${rv},0)`]]) { g.fillStyle = s; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } };
  const grime = (alpha) => { for (let i = 0; i < 90; i++) { const x = R() * H, y = R() * H, r = 10 + R() * 60, gr = cg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(10,10,12,${alpha * R()})`); gr.addColorStop(1, 'rgba(10,10,12,0)'); cg.fillStyle = gr; cg.fillRect(x - r, y - r, r * 2, r * 2); } };
  const frame = (lip, seam) => { // the plate's edge: a dark seam, a raised worn lip
    both(0, 0, H, seam, '#141518', 0, 230); both(0, H - seam, H, seam, '#141518', 0, 230); both(0, 0, seam, H, '#141518', 0, 230); both(H - seam, 0, seam, H, '#141518', 0, 230);
    for (const [x, y, w, h] of [[seam, seam, H - 2 * seam, lip], [seam, H - seam - lip, H - 2 * seam, lip], [seam, seam, lip, H - 2 * seam], [H - seam - lip, seam, lip, H - 2 * seam]]) both(x, y, w, h, '#5b6067', 200, 95);
  };
  const rivets = (inset, step) => { for (let t = inset + step / 2; t < H - inset; t += step) for (const [x, y] of [[t, inset], [t, H - inset], [inset, t], [H - inset, t]]) { dot(x, y, 3.2, '#8a9099', 230, 70); dot(x - 0.8, y - 0.8, 1.4, '#c4c9cf', 255, 40); } };

  // tread plate: raised squares in rows, worn bright on their tops
  region(0, 0, () => {
    both(0, 0, H, H, '#52555c', 70, 125);
    const pitch = 28, sq = 17;
    for (let y = 22; y < H - 22; y += pitch) for (let x = 22; x < H - 22; x += pitch) {
      const wear = R(); both(x, y, sq, sq, wear > 0.85 ? '#686c73' : '#5b5f66', 150, wear > 0.85 ? 65 : 100);
      both(x, y, sq, 2, '#62666d', 165, 75); both(x, y + sq - 2, sq, 2, '#33363a', 130, 130);
    }
    grime(0.35); frame(7, 3); rivets(12, 38);
  });
  // walkway grating: a raised frame, cross bars every half metre, long bars close together, black below
  region(H, 0, () => {
    both(0, 0, H, H, '#17181b', 0, 250);
    for (let y = 0; y < H; y += 8) both(0, y, H, 3, '#6d7178', 190, 70);     // the long bars (along u), close together: bare silver-grey
    for (let x = 0; x < H; x += 22) both(x, 0, 3, H, '#5a5e65', 170, 85);    // the short ties
    for (let x = 0; x < H; x += 128) both(x - 5, 0, 10, H, '#5a5f66', 215, 85); // a cross bar every half metre
    for (let i = 0; i < 60; i++) { const x = R() * H, y = R() * H; both(x, y, 6 + R() * 30, 4, `rgba(140,148,158,${0.15 + R() * 0.25})`); }
    frame(13, 3);
  });
  // vent plate: two columns of slots in a riveted frame
  region(0, H, () => {
    both(0, 0, H, H, '#3a3d43', 120, 120);
    for (let y = 46; y < H - 50; y += 22) for (const x0 of [44, 266]) { both(x0, y, 202, 10, '#060607', 10, 250); both(x0, y + 10, 202, 2, '#62676f', 160, 80); }
    both(250, 30, 12, H - 60, '#4b4f56', 150, 100);
    grime(0.4); frame(9, 3); rivets(16, 40);
  });
  // plain deck: smooth dark plate with a faint brushed grain
  region(H, H, () => {
    both(0, 0, H, H, '#34373d', 120, 105);
    cg.globalAlpha = 0.08; for (let y = 0; y < H; y += 2) { cg.fillStyle = R() < 0.5 ? '#000' : '#9aa0a8'; cg.fillRect(0, y, H, 1); } cg.globalAlpha = 1;
    grime(0.25); frame(6, 3);
    for (const [x, y] of [[20, 20], [H - 20, 20], [20, H - 20], [H - 20, H - 20]]) dot(x, y, 4, '#878d96', 220, 60);
  });

  // bumps from the height picture (a Sobel slope), as a tangent-space normal map
  const hd = hg.getImageData(0, 0, S, S).data, nc = canvas(S), ng = nc.getContext('2d'), ni = ng.createImageData(S, S), nd = ni.data, k = 2.2;
  const hAt = (x, y) => hd[((Math.min(S - 1, Math.max(0, y))) * S + Math.min(S - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * k, dy = (hAt(x, y + 1) - hAt(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    nd[i] = (-dx / l * 0.5 + 0.5) * 255; nd[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd[i + 3] = 255;
  }
  ng.putImageData(ni, 0, 0);
  const t = [tex(col, true, false), tex(nc, false, false), tex(rgh, false, false)];
  return { map: t[0], normalMap: t[1], roughnessMap: t[2] };
}

// ── decals: white on clear, in cells of 256 x 64 px (8 across... 4 across, 16 down) ───────────────────────────────
export const LABELS = ['BUS-C', 'AIR-2', 'DECK 1', 'LAB-3', 'HAB-A', 'O2', 'GALLEY', 'DOCK-4', 'BUS-D', 'CREW', 'BRIDGE', 'ENG-1',
  'PAD 1', 'CARGO', 'HANGAR', 'TERMINAL', 'QUARTERS', 'DECK 2', 'KESTREL', 'FUEL'];
// (the first twelve labels fill cells 0-11; cells 12-15 hold the breaker tags, stripes, arrow and swatch; the rest
// of the labels carry on from cell 16)
const labelCell = (i) => (i < 12 ? i : i + 4);
export function decalAtlas() {
  const S = 1024, c = canvas(S), g = c.getContext('2d'), rect = {};
  const cell = (i) => { const col = i % 4, row = Math.floor(i / 4); return [col * 256, row * 64]; };
  const uvOf = (x, y, w, h) => [x / S, 1 - (y + h) / S, (x + w) / S, 1 - y / S];
  // stencil lettering: bold capitals with the stencil's bridges cut through them
  LABELS.forEach((txt, i) => {
    const [x, y] = cell(labelCell(i));
    g.save(); g.beginPath(); g.rect(x, y, 256, 64); g.clip();
    g.fillStyle = '#fff'; g.font = 'bold 46px "DejaVu Sans Mono", "Consolas", "Menlo", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(txt).width, sx = Math.min(1, 236 / w);
    g.translate(x + 128, y + 34); g.scale(sx, 1); g.fillText(txt, 0, 0);
    g.restore();
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (let k = 0; k < 2; k++) g.fillRect(x, y + 22 + k * 19, 256, 2.5);    // the stencil's bridges: two thin breaks
    g.restore();
    rect['label:' + txt] = uvOf(x, y, 256, 64);
  });
  // a breaker's label strip: four small white tags with marks
  { const [x, y] = cell(12); g.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { g.fillRect(x + 8 + k * 62, y + 12, 52, 40); } g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 4; k++) { g.fillRect(x + 14 + k * 62, y + 22, 30, 5); g.fillRect(x + 14 + k * 62, y + 34, 22, 4); } g.globalCompositeOperation = 'source-over'; rect.breakerTags = uvOf(x, y, 256, 64); }
  // hazard stripes (yellow and black chevrons drawn in white and clear, tinted yellow)
  { const [x, y] = cell(13); g.save(); g.beginPath(); g.rect(x, y, 256, 64); g.clip(); g.fillStyle = '#fff'; for (let k = -2; k < 10; k++) { g.beginPath(); g.moveTo(x + k * 32, y + 64); g.lineTo(x + k * 32 + 16, y + 64); g.lineTo(x + k * 32 + 48, y); g.lineTo(x + k * 32 + 32, y); g.fill(); } g.restore(); rect.hazard = uvOf(x, y, 256, 64); }
  // a little arrow and a ring (for signs)
  { const [x, y] = cell(14); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 20, y + 24); g.lineTo(x + 150, y + 24); g.lineTo(x + 150, y + 10); g.lineTo(x + 200, y + 32); g.lineTo(x + 150, y + 54); g.lineTo(x + 150, y + 40); g.lineTo(x + 20, y + 40); g.fill(); rect.arrow = uvOf(x, y, 256, 64); }
  // a solid white swatch (for painted marks that only need the tint)
  { const [x, y] = cell(15); g.fillStyle = '#fff'; g.fillRect(x + 4, y + 4, 248, 56); rect.solid = uvOf(x + 8, y + 8, 240, 48); }
  cockpitPrint(g, cell, uvOf, rect);
  cabinPrint(g, cell, uvOf, rect);   // (a ship cabin's posters, door signs, stencils and labels: cells 24-55, which the station never uses)
  const t = tex(c, true, false); t.generateMipmaps = true;
  return { map: t, rect };
}

// the ship cockpit's panel print (kit/shipparts/cockpit), in the sheet's last eight cells (56-63; the station's pieces
// use none of them): switch and knob legends (strips of 256 x 16, one name per switch, for rows of 3 to 6: sets 'a' and
// 'b' for switches, 'c' for knobs), a throttle scale, a knob's tick ring, a STORAGE stencil, a CAUTION plate and the
// seats' role badges
function cockpitPrint(g, cell, uvOf, rect) {
  const F = (px) => `bold ${px}px "DejaVu Sans", Arial, sans-serif`, fit = (t, x, y, mw) => { const w = g.measureText(t).width, s = Math.min(1, mw / w); g.save(); g.translate(x, y); g.scale(s, 1); g.fillText(t, 0, 0); g.restore(); };
  const clip = (x, y, w, h, fn) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fn(); g.restore(); };
  // (names spelled out in full, for children reading them)
  const NAMES = { a: ['ENGINE 1', 'ENGINE 2', 'PUMP', 'NAV', 'RADIO', 'LIGHTS'], b: ['HEAT', 'AIR', 'SHIELD', 'GEAR', 'DOCK', 'BEACON'], c: ['VOLUME', 'BRIGHT', 'TEMP', 'FAN', 'MAP', 'ZOOM'] };
  ['a', 'b', 'c'].forEach((k, j) => {
    const [x, y] = cell(j < 2 ? 56 + j : 62);
    for (let n = 3; n <= 6; n++) {
      const yy = y + (n - 3) * 16;
      clip(x, yy, 256, 16, () => { g.font = F(11); for (let i = 0; i < n; i++) fit(NAMES[k][i], x + 256 * (i + 0.5) / n, yy + 8.5, 256 / n - 12); });
      rect[`cp:lg${n}${k}`] = uvOf(x, yy, 256, 16);
    }
  });
  { const [x, y] = cell(58); clip(x, y, 256, 64, () => { g.lineWidth = 3; for (let i = 0; i <= 20; i++) { const tx = x + 12 + i * 11.6; g.fillRect(tx - 1.5, y + 6, 3, i % 5 ? 12 : 22); } g.font = F(16); ['0', '25', '50', '75', 'MAX'].forEach((t, i) => fit(t, x + 12 + i * 58, y + 46, 50)); }); rect['cp:scale'] = uvOf(x, y, 256, 64); }
  { const [x, y] = cell(59); clip(x, y, 64, 64, () => { for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.75 + i * 0.15); g.save(); g.translate(x + 32, y + 32); g.rotate(a); g.fillRect(19, -1.5, i % 5 ? 8 : 12, 3); g.restore(); } }); rect['cp:ticks'] = uvOf(x, y, 64, 64); }
  { const [x, y] = cell(60); clip(x, y, 256, 64, () => { g.font = F(44); fit('STORAGE', x + 128, y + 34, 236); g.save(); g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 2; k++) g.fillRect(x, y + 22 + k * 19, 256, 2.5); g.restore(); }); rect['cp:stow'] = uvOf(x, y, 256, 64); }
  { const [x, y] = cell(61); clip(x, y, 256, 64, () => { g.lineWidth = 4; g.strokeRect(x + 6, y + 6, 244, 52); g.font = F(36); fit('CAUTION', x + 128, y + 33, 220); }); rect['cp:caution'] = uvOf(x, y, 256, 64); }
  // the seats' role badges: four 128 x 32 tags in cell 63, white capitals in a thin frame
  { const [x, y] = cell(63); ['PILOT', 'CO-PILOT', 'ENGINEER', 'CREW'].forEach((t, i) => { const bx = x + (i % 2) * 128, by = y + Math.floor(i / 2) * 32; clip(bx, by, 128, 32, () => { g.lineWidth = 2; g.strokeRect(bx + 3, by + 3, 122, 26); g.font = F(19); fit(t, bx + 64, by + 17, 110); }); rect['cp:badge:' + t.toLowerCase()] = uvOf(bx, by, 128, 32); }); }
}

// ── screens: glowing faces in a 1024 x 1024 sheet ────────────────────────────────────────────────────────────────
//   the top half: four wall screens, 512 x 256 each (math station, status, terminal, radar)
//   the bottom half: the jobs board (640 x 256), the galley's menu and the drinks panel beside it; a captain's card for
//   each kind of crew (192 x 128) and the fuel pump's screen; then two rows of lit signs (256 x 64)
const SUV = (x, y, w, h) => [x / 1024, 1 - (y + h) / 1024, (x + w) / 1024, 1 - y / 1024];
export const SIGNS = ['TERMINAL', 'HANGAR', 'QUARTERS', 'GALLEY', 'JOBS', 'DOCK', 'DECK 2', 'EXIT'];
export const CREWS = { medic: ['MEDIC', 'CAPT. R. VANCE', '#ff6a5a'], mining: ['MINING', 'CAPT. D. HOLLIS', '#ffa53a'], explore: ['EXPLORER', 'CAPT. I. NAKAMURA', '#5fe08a'], security: ['SECURITY', 'CAPT. B. ADAIR', '#5aa8ff'] };
export const SCREEN_RECT = {
  math: SUV(0, 0, 512, 256), status: SUV(512, 0, 512, 256), terminal: SUV(0, 256, 512, 256), radar: SUV(512, 256, 512, 256),
  jobs: SUV(0, 512, 640, 256), menu: SUV(640, 512, 384, 160), drinks: SUV(640, 672, 384, 96), fuel: SUV(768, 768, 192, 128),
  ...Object.fromEntries(Object.keys(CREWS).map((k, i) => ['crew:' + k, SUV(i * 192, 768, 192, 128)])),
  ...Object.fromEntries(SIGNS.map((n, i) => ['sign:' + n, SUV((i % 4) * 256, 896 + Math.floor(i / 4) * 64, 256, 64)])),
};
export function screenAtlas() {
  const c = canvas(1024, 1024), g = c.getContext('2d'), R = rng(5);
  const panel = (x, y) => {
    const gr = g.createLinearGradient(x, y, x, y + 256); gr.addColorStop(0, '#24627f'); gr.addColorStop(1, '#173f57'); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
    g.strokeStyle = 'rgba(120,200,255,0.14)'; g.lineWidth = 1; for (let k = 0; k < 512; k += 32) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + 256); g.stroke(); } for (let k = 0; k < 256; k += 32) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + 512, y + k); g.stroke(); }
    g.strokeStyle = '#59c3ff'; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, 496, 240);
  };
  g.textBaseline = 'middle'; g.textAlign = 'left';
  // a math station: a sum waiting for its answer
  panel(0, 0); g.fillStyle = '#d8f1ff'; g.font = 'bold 30px "DejaVu Sans", Arial, sans-serif'; g.fillText('CARGO BAY', 28, 40);
  g.font = 'bold 84px "DejaVu Sans", Arial, sans-serif'; g.fillStyle = '#ffffff'; g.fillText('6 × 7 =', 40, 140);
  g.strokeStyle = '#ffe3a0'; g.lineWidth = 6; g.strokeRect(348, 92, 130, 96); g.fillStyle = '#ffe3a0'; g.font = 'bold 70px "DejaVu Sans", Arial, sans-serif'; g.fillText('?', 393, 142);
  g.fillStyle = '#59c3ff'; for (let k = 0; k < 6; k++) g.fillRect(28 + k * 76, 214, 60, 14);
  // status: bars and numbers
  panel(512, 0); g.fillStyle = '#d8f1ff'; g.font = 'bold 28px "DejaVu Sans", Arial, sans-serif'; g.fillText('LIFE SUPPORT', 540, 40);
  [['O2', 0.92], ['H2O', 0.71], ['PWR', 0.84], ['TEMP', 0.55]].forEach(([n, v], k) => { const y = 82 + k * 42; g.fillStyle = '#9fd8ff'; g.font = 'bold 22px "DejaVu Sans", Arial, sans-serif'; g.fillText(n, 540, y + 12); g.fillStyle = 'rgba(89,195,255,0.25)'; g.fillRect(630, y, 300, 24); g.fillStyle = v < 0.6 ? '#ffb347' : '#59c3ff'; g.fillRect(630, y, 300 * v, 24); g.fillStyle = '#fff'; g.fillText(Math.round(v * 100) + '%', 944, y + 12); });
  // terminal: lines of text
  panel(0, 256); g.font = '20px "DejaVu Sans Mono", monospace'; for (let k = 0; k < 8; k++) { g.fillStyle = k === 7 ? '#ffffff' : '#7fcfff'; const s = ['> DOCKING CLAMPS ...... OK', '> HULL PRESSURE ....... 101 kPa', '> BUS-C LOAD .......... 64%', '> AIRLOCK 2 ........... SEALED', '> CREW ON DECK ........ 3', '> NEXT CONTRACT ....... 2 h', '> DRONE BAY ........... READY', '> _'][k]; g.fillText(s, 26, 256 + 30 + k * 27); }
  // radar: rings and blips
  panel(512, 256); g.strokeStyle = '#59c3ff'; g.lineWidth = 2; for (let r = 30; r <= 110; r += 40) { g.beginPath(); g.arc(768, 384, r, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(768, 274); g.lineTo(768, 494); g.moveTo(658, 384); g.lineTo(878, 384); g.stroke();
  g.fillStyle = 'rgba(89,195,255,0.35)'; g.beginPath(); g.moveTo(768, 384); g.arc(768, 384, 110, -0.9, -0.3); g.fill();
  for (let k = 0; k < 7; k++) { const a = R() * 6.28, r = 20 + R() * 85; g.fillStyle = k === 2 ? '#ffd35a' : '#d8f1ff'; g.beginPath(); g.arc(768 + Math.cos(a) * r, 384 + Math.sin(a) * r, 5, 0, 7); g.fill(); }
  g.fillStyle = '#d8f1ff'; g.font = 'bold 24px "DejaVu Sans", Arial, sans-serif'; g.fillText('SECTOR 7', 900, 290);
  bigScreens(g);
  const t = tex(c, true, false); return { map: t };
}

// the bottom half of the screen sheet: the jobs board, the galley's boards, the captains' cards, the lit signs
function bigScreens(g) {
  const F = (px, bold = true) => (bold ? 'bold ' : '') + px + 'px "DejaVu Sans", Arial, sans-serif';
  const bg = (x, y, w, h, a = '#1d5573', b = '#123448', edge = '#59c3ff') => {
    const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.strokeStyle = edge; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  };
  g.textBaseline = 'middle';
  // the jobs board: captains hiring, one row each (the colour of the crew, the job, the captain, the pay)
  bg(0, 512, 640, 256, '#163f5a', '#0d2638');
  g.fillStyle = '#ffffff'; g.font = F(34); g.textAlign = 'left'; g.fillText('JOBS BOARD', 26, 548);
  g.fillStyle = '#9fd8ff'; g.font = F(18, false); g.textAlign = 'right'; g.fillText('CAPTAINS HIRING TODAY', 614, 550);
  g.fillStyle = 'rgba(89,195,255,0.5)'; g.fillRect(22, 572, 596, 2);
  const rows = [['medic', 'RESCUE THE STASIS PODS', '120'], ['mining', 'ZAP THE ORE ASTEROIDS', '150'], ['explore', 'MAP THE BLUE NEBULA', '100'], ['security', 'GUARD A CARGO HAULER', '130']];
  rows.forEach(([k, job, pay], i) => {
    const y = 600 + i * 42, [crew, capt, col] = CREWS[k];
    g.fillStyle = i % 2 ? 'rgba(89,195,255,0.06)' : 'rgba(89,195,255,0.12)'; g.fillRect(22, y - 18, 596, 38);
    g.fillStyle = col; g.fillRect(26, y - 13, 10, 28);
    g.textAlign = 'left'; g.fillStyle = col; g.font = F(17); g.fillText(crew, 46, y - 4);
    g.fillStyle = '#cfeaff'; g.font = F(13, false); g.fillText(capt, 46, y + 12);
    g.fillStyle = '#ffffff'; g.font = F(19); g.fillText(job, 210, y + 1);
    g.textAlign = 'right'; g.fillStyle = '#ffe3a0'; g.font = F(22); g.fillText(pay + ' CR', 612, y + 1);
  });
  // the galley's menu, and the drinks panel under it
  bg(640, 512, 384, 160, '#3a2a18', '#221810', '#ffb347');
  g.textAlign = 'left'; g.fillStyle = '#ffd59a'; g.font = F(28); g.fillText('GALLEY', 664, 544);
  g.fillStyle = '#ffeeda'; g.font = F(16, false); g.textAlign = 'right'; g.fillText('OPEN ALL CYCLE', 1000, 546);
  [['NOODLE BOWL', '4'], ['ORBIT STEW', '5'], ['MOON PIE', '2'], ['FRUIT CUP', '2']].forEach(([n, c], i) => {
    const y = 578 + i * 23; g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = F(17); g.fillText(n, 668, y);
    g.textAlign = 'right'; g.fillStyle = '#ffd59a'; g.fillText(c + ' CR', 1000, y);
  });
  bg(640, 672, 384, 96, '#173f57', '#0d2638');
  [['WATER', '#59c3ff'], ['JUICE', '#ffa53a'], ['COCOA', '#c98a5a']].forEach(([n, col], i) => {
    const x = 660 + i * 120; g.fillStyle = col; g.beginPath(); g.arc(x + 20, 720, 16, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = F(17); g.fillText(n, x + 42, 720);
  });
  // a captain's card for each crew: the crew's colour, a head and shoulders, the name
  Object.values(CREWS).forEach(([crew, capt, col], i) => {
    const x = i * 192, y = 768; bg(x, y, 192, 128, '#173f57', '#0d2638', col);
    g.fillStyle = col; g.fillRect(x + 10, y + 10, 172, 22);
    g.fillStyle = '#0d2638'; g.font = F(15); g.textAlign = 'center'; g.fillText(crew, x + 96, y + 22);
    g.fillStyle = 'rgba(207,234,255,0.85)'; g.beginPath(); g.arc(x + 44, y + 68, 15, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x + 44, y + 108, 28, 18, 0, Math.PI, 0); g.fill();
    const nm = capt.replace('CAPT. ', ''); g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = F(20); const sw = Math.min(1, 100 / g.measureText(nm).width); g.save(); g.translate(x + 80, y + 66); g.scale(sw, 1); g.fillText(nm, 0, 0); g.restore();
    g.fillStyle = '#9fd8ff'; g.font = F(15); g.fillText('CAPTAIN', x + 80, y + 92);
  });
  // the fuel pump's screen
  bg(768, 768, 192, 128, '#2e2a12', '#1b190b', '#ffd35a');
  g.fillStyle = '#ffe9a0'; g.font = F(22); g.textAlign = 'left'; g.fillText('FUEL', 786, 800);
  g.fillStyle = 'rgba(255,211,90,0.25)'; g.fillRect(786, 828, 154, 20); g.fillStyle = '#ffd35a'; g.fillRect(786, 828, 126, 20);
  g.fillStyle = '#ffffff'; g.font = F(16); g.fillText('82%  READY', 786, 870);
  // lit signs: white capitals on a deep blue panel
  SIGNS.forEach((n, i) => {
    const x = (i % 4) * 256, y = 896 + Math.floor(i / 4) * 64;
    g.fillStyle = '#0b1d2c'; g.fillRect(x, y, 256, 64); g.strokeStyle = '#3aa0e0'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, 248, 56);
    g.fillStyle = '#eaf6ff'; g.font = F(34); g.textAlign = 'center';
    const w = g.measureText(n).width, sx = Math.min(1, 220 / w); g.save(); g.translate(x + 128, y + 33); g.scale(sx, 1); g.fillText(n, 0, 0); g.restore();
  });
  g.textAlign = 'left';
}
