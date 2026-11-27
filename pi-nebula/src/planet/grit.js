// THE GROUND UNDERFOOT: what a person standing on a planet sees at their feet. Two blind critics (2026-11-26) found it
// a blurry smear of blotches, or one flat colour, on every kind of planet: no stones, cracks, tufts or ripples. This is
// a small picture of that grain, made here in code, that repeats; the ground's picture (src/planet/ground.js) lays it
// over the ground near the camera only (it fades out by GRIT.far metres), twice, at two sizes and turned against each
// other so it does not repeat in a pattern you can see, and each kind of ground takes what fits it (GRIT.kinds).
// Plain numbers, no THREE: the tests read it in node.
//
//   gritData(size)    Uint8Array size x size x 4, repeating at its edges:
//                     R  small stones: 0 none, else the stone (its shade: 1 .. 255, darker toward its edge)
//                     G  cracks: how dark (thin lines between the cells of dried ground)
//                     B  tufts: short blades of grass and dry stalks (how much)
//                     A  ripples: wind ripples in sand (128 the middle, lighter and darker either side)
//   GRIT.kinds[id]    how much of each a kind of ground shows: [stones, cracks, tufts, ripples], and where (tufts where
//                     something grows, ripples on the loose ground, cracks on the hard)
export const GRIT = {
  size: 512,
  far: 26,                // metres: gone by here (only on the best quality: on a phone's it read as polka dots)
  scales: [1.9, 0.62],    // metres across one repeat of the picture, the two layers
  kinds: {
    moon: [0.6, 0.2, 0.0, 0.0],
    meadow: [0.35, 0.15, 1.0, 0.0],
    canyon: [0.4, 0.45, 0.35, 1.0],
  },
};

function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function gritData(S = GRIT.size) {
  const out = new Uint8Array(S * S * 4), R = rand(7331);
  // ── STONES: round-ish pebbles of many sizes, scattered (a jittered grid, each cell maybe a stone) ──
  const stone = new Float32Array(S * S);
  const placeStones = (cells, chance, rMin, rMax) => {
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
      if (R() > chance) continue;
      const cx = (i + R()) / cells * S, cy = (j + R()) / cells * S, r = (rMin + (rMax - rMin) * R() ** 2) * S, sq = 0.6 + 0.5 * R(), a = R() * Math.PI, shade = 0.35 + 0.65 * R();
      const ca = Math.cos(a), sa = Math.sin(a), n = Math.ceil(r * 1.6);
      for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) {
        const u = (x * ca + y * sa) / r, v = (-x * sa + y * ca) / (r * sq), d = u * u + v * v;
        if (d >= 1) continue;
        const px = ((Math.floor(cx + x) % S) + S) % S, py = ((Math.floor(cy + y) % S) + S) % S, k = py * S + px;
        // (lit from one side, a darker rim where it meets the ground)
        const lit = shade * (0.75 + 0.35 * (-u * 0.6 - v * 0.5)) * (1 - 0.45 * d * d);
        stone[k] = Math.max(stone[k], Math.max(0.02, Math.min(1, lit)));
      }
    }
  };
  placeStones(26, 0.45, 0.004, 0.012); placeStones(12, 0.35, 0.010, 0.026); placeStones(5, 0.4, 0.022, 0.045);
  // ── CRACKS: the edges between cells of dried ground (the gap between nearest and second-nearest of scattered points) ──
  const C = 9, pts = []; for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + 0.15 + 0.7 * R()) / C, (j + 0.15 + 0.7 * R()) / C]);
  const crack = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, ci = Math.floor(u * C), cj = Math.floor(v * C); let d1 = 9, d2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ((ci + di) % C + C) % C, jj = ((cj + dj) % C + C) % C, p = pts[jj * C + ii];
      const px = p[0] + Math.floor((ci + di) / C), py = p[1] + Math.floor((cj + dj) / C);
      const dx = px - u, dy = py - v, d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const e = (d2 - d1) * S;      // (pixels from the edge between two cells)
    crack[y * S + x] = Math.max(0, 1 - e / 1.6);
  }
  // ── TUFTS: short blades, leaning every way, in small clumps ──
  const tuft = new Float32Array(S * S);
  for (let c = 0; c < 260; c++) {
    const cx = R() * S, cy = R() * S, blades = 3 + Math.floor(R() * 7), lean0 = R() * Math.PI * 2;
    for (let b = 0; b < blades; b++) {
      const a = lean0 + (R() - 0.5) * 2.2, len = (0.012 + 0.03 * R()) * S, ox = (R() - 0.5) * 6, oy = (R() - 0.5) * 6, w = 0.5 + 0.6 * R();
      for (let t = 0; t <= 1; t += 0.5 / len) {
        const x = cx + ox + Math.cos(a) * len * t, y = cy + oy + Math.sin(a) * len * t, k = (((Math.floor(y) % S) + S) % S) * S + (((Math.floor(x) % S) + S) % S);
        tuft[k] = Math.max(tuft[k], w * (1 - 0.5 * t));
      }
    }
  }
  // ── RIPPLES: wind ripples, wavy, a few to the picture's width, their crests sharper on one side ──
  const rip = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, warp = 0.035 * Math.sin(2 * Math.PI * (u * 2 + 0.3)) + 0.02 * Math.sin(2 * Math.PI * (u * 5 + v * 1));
    const ph = (v + warp) * 11, f = ph - Math.floor(ph);
    rip[y * S + x] = f < 0.7 ? f / 0.7 : (1 - f) / 0.3;     // (a long gentle side and a short steep one)
  }
  for (let k = 0; k < S * S; k++) {
    out[k * 4] = Math.round(stone[k] * 255);
    out[k * 4 + 1] = Math.round(crack[k] * 255);
    out[k * 4 + 2] = Math.round(Math.min(1, tuft[k]) * 255);
    out[k * 4 + 3] = Math.round(rip[k] * 255);
  }
  return out;
}
