// TEXTURES for the station kit, all drawn in code (canvas), nothing downloaded:
//   wear    a tiling 2 m patch for the painted panels: R smudges, G scuffs and scratches, B fine grain
//   floor   one atlas for every floor tile (colour, roughness, bumps): tread plate, walkway grating, vent plate, plain
//           deck, each a 2 x 2 m square
//   decal   stencil labels, breaker labels, hazard stripes (white on clear, tinted by the piece)
//   screen  the glowing blue screens (a math station, a status board, a terminal, a radar)
//   stars   the view out of a window: an equirectangular sky of stars, a faint band of the galaxy and a planet
import * as THREE from 'three';

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
export const LABELS = ['BUS-C', 'AIR-2', 'DECK 1', 'LAB-3', 'HAB-A', 'O2', 'GALLEY', 'DOCK-4', 'BUS-D', 'CREW', 'BRIDGE', 'ENG-1'];
export function decalAtlas() {
  const S = 1024, c = canvas(S), g = c.getContext('2d'), rect = {};
  const cell = (i) => { const col = i % 4, row = Math.floor(i / 4); return [col * 256, row * 64]; };
  const uvOf = (x, y, w, h) => [x / S, 1 - (y + h) / S, (x + w) / S, 1 - y / S];
  // stencil lettering: bold capitals with the stencil's bridges cut through them
  LABELS.forEach((txt, i) => {
    const [x, y] = cell(i);
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
  const t = tex(c, true, false); t.generateMipmaps = true;
  return { map: t, rect };
}

// ── screens: glowing blue faces, each 512 x 256 in a 1024 x 512 sheet ────────────────────────────────────────────
export const SCREEN_RECT = { math: [0, 0.5, 0.5, 1], status: [0.5, 0.5, 1, 1], terminal: [0, 0, 0.5, 0.5], radar: [0.5, 0, 1, 0.5] };
export function screenAtlas() {
  const c = canvas(1024, 512), g = c.getContext('2d'), R = rng(5);
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
  const t = tex(c, true, false); return { map: t };
}

// ── the stars outside ────────────────────────────────────────────────────────────────────────────────────────────
export function starSky(w = 2048) {
  const h = w / 2, c = canvas(w, h), g = c.getContext('2d'), R = rng(23);
  g.fillStyle = '#020309'; g.fillRect(0, 0, w, h);
  // a faint band of the galaxy across the sky
  for (let i = 0; i < 900; i++) { const x = R() * w, y = h * 0.5 + Math.sin(x / w * Math.PI * 2) * h * 0.18 + (R() - 0.5) * h * 0.16, r = 8 + R() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${90 + R() * 60},${80 + R() * 50},${140 + R() * 80},0.05)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 5200; i++) { const x = R() * w, y = R() * h, b = R(), s = b > 0.995 ? 1.8 : b > 0.96 ? 1.1 : 0.6; g.fillStyle = `rgba(${215 + R() * 40},${215 + R() * 40},255,${0.25 + b * 0.75})`; g.fillRect(x, y, s, s); }
  // a small grey moon off along +x (where side corridors' windows look)
  { const mx = w * 0.574, my = h * 0.436, mr = h * 0.035, mg = g.createRadialGradient(mx + mr * 0.35, my - mr * 0.3, mr * 0.1, mx, my, mr); mg.addColorStop(0, '#e8e6e0'); mg.addColorStop(0.7, '#8d8a84'); mg.addColorStop(1, '#2b2a28');
    g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(60,58,55,0.35)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(mx + (R() - 0.5) * mr * 1.2, my + (R() - 0.5) * mr * 1.2, mr * (0.08 + R() * 0.15), 0, 7); g.fill(); } }
  // a blue-green planet just above the horizon: soft seas and lands, blurred clouds, a night side and a thin
  // glowing rim of air
  const px = w * 0.75, py = h * 0.45, pr = h * 0.12;
  g.save(); g.shadowColor = 'rgba(120,190,255,0.9)'; g.shadowBlur = pr * 0.25; g.fillStyle = '#2a6fae'; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.clip();
  const sea = g.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr); sea.addColorStop(0, '#5fb0e8'); sea.addColorStop(1, '#1d4f86'); g.fillStyle = sea; g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  g.filter = `blur(${Math.round(pr * 0.05)}px)`;
  for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(${90 + R() * 50},${120 + R() * 40},${70 + R() * 30},0.55)`; g.beginPath(); g.ellipse(px + (R() - 0.5) * pr * 1.8, py + (R() - 0.5) * pr * 1.6, pr * (0.08 + R() * 0.2), pr * (0.05 + R() * 0.12), R() * 3, 0, 7); g.fill(); }
  g.filter = `blur(${Math.round(pr * 0.03)}px)`;
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(245,250,255,${0.25 + R() * 0.35})`; g.beginPath(); g.ellipse(px + (R() - 0.5) * pr * 1.9, py + (R() - 0.5) * pr * 1.8, pr * (0.1 + R() * 0.3), pr * (0.015 + R() * 0.04), (R() - 0.5) * 0.4, 0, 7); g.fill(); }
  g.filter = 'none';
  const night = g.createRadialGradient(px - pr * 0.55, py - pr * 0.35, pr * 0.2, px - pr * 0.2, py - pr * 0.1, pr * 1.45); night.addColorStop(0, 'rgba(0,0,0,0)'); night.addColorStop(0.55, 'rgba(0,0,0,0.15)'); night.addColorStop(1, 'rgba(1,3,10,0.94)');
  g.fillStyle = night; g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  g.restore();
  g.strokeStyle = 'rgba(150,210,255,0.55)'; g.lineWidth = pr * 0.025; g.beginPath(); g.arc(px, py, pr * 1.005, Math.PI * 0.75, Math.PI * 1.75); g.stroke();
  const t = tex(c, true, false); t.mapping = THREE.EquirectangularReflectionMapping; return t;
}
