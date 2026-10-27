// THE STONE WALL MAKER: walls built stone by stone in code, for any stone thing the game needs: a wall with a door and a
// window, an outside corner, a chimney, a jail block, a foundation under a building, a low field wall. Three styles:
//
//   mortared    odd-shaped stones of many sizes laid flat, in rough rows that keep breaking (random rubble brought to
//               rough courses): rows of every height, beds that tilt, a third of the stones two rows tall, some split
//               into two small ones, a little wedge stone in some of the joints, two or three corners knocked off every
//               stone, no joint right over the one below. Corner stones and the stones beside a door or window are the
//               same stones, long and short in turn; a lintel over each opening, a sill under a window.
//   drystack    the way a person stacks stones they found, no mortar: keep the wall's lumpy top line, find its lowest
//               dip, try stones from the pile there (flat side down), keep the one that sits best, repeat; small stones
//               knocked to fit the gaps the pile can't fill.
//   ledgestone  thin flat slabs of uneven thickness, stacked the same way, their ends broken off, a thick one now and then.
//
// HOW A WALL IS LAID OUT: each block of wall (a footprint outline standing up from the ground) is unrolled into one long
// strip, corner to corner all the way round, the stones are laid out flat on that strip, then the strip is folded back
// round the footprint. A stone that crosses a corner folds round it, which is what makes a corner stone.
//
// HOW A STONE IS DRAWN: its face is a fan of triangles round a point pushed out from it (the bulge), so a six-sided stone
// is six triangles. Its sides are only drawn where they can be seen: in a door or window opening, along the edge of a
// coping stone on the wall top, round a chimney's flue. Every corner carries how far it is from the stone's outline
// (aRim), so the shader can darken the edges without more triangles, and the height of the ledge water runs off above
// it (aDrip: the coping, or a window sill), so rain streaks start in the right place.
//
// buildStoneWall(recipe) returns two merged BufferGeometries (stone and mortar, two draw calls) and what the game needs
// to fit doors and windows. A RECIPE is everything that makes one building's stonework its own (style, colours, mortar,
// seed, stone size...): small and plain, so a town can keep one per building (see stoneRecipe). Nothing here touches
// the page: the game can use it as it is.

import * as THREE from 'three';

// ── seeded random numbers (the same seed builds the same wall) ─────────────────────────────────────────────────────────
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (R) => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(6.283185 * R());
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
// smooth noise in 3D (0..1), for colours that drift slowly across a wall
function noise3(x, y, z, seed) {
  const h = (i, j, k) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647) + Math.imul(seed, 982451653); n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (t) => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}

export const TILE = 0.7;                       // metres to one repeat of the stone texture

// ── a building's recipe ─────────────────────────────────────────────────────────────────────────────────────────────
// shape (a key of SHAPES), style (STYLES), palette (PALETTES, or 'auto': the shape's or style's own), mortar (MORTARS),
// seed (which wall of all the walls that recipe could build), size (a typical stone, metres), irregularity (0..1),
// colourMix (0: more of the palette's base colour, 1: more of its second), bulge (0..2: how far the stones stand out),
// joint (the joint's width, metres)
export const RECIPE_DEFAULTS = { shape: 'wall', style: 'mortared', palette: 'auto', mortar: 'grey', seed: 1, size: 0.3, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012 };
const RANGES = { seed: [1, 1e9], size: [0.12, 0.8], irregularity: [0, 1], colourMix: [0, 1], bulge: [0, 2], joint: [0, 0.05] };
// a recipe tidied up: only the keys above, each a known name or a number in range (what a town would store per building)
export function stoneRecipe(r = {}) {
  const out = { ...RECIPE_DEFAULTS };
  for (const k in RECIPE_DEFAULTS) {
    const v = r[k]; if (v === undefined || v === null) continue;
    if (RANGES[k]) { const n = +v; if (Number.isFinite(n)) out[k] = k === 'seed' ? Math.round(clamp(n, ...RANGES[k])) : clamp(n, ...RANGES[k]); }
    else if (k === 'shape' ? SHAPES[v] : k === 'style' ? STYLES[v] : k === 'palette' ? v === 'auto' || PALETTES[v] : MORTARS[v]) out[k] = v;
  }
  return out;
}
// THE MORTAR: one family for every style. Light lime is its own off-white whatever the stone; grey and dark go by the
// stones: how light next to them (their base colour's lightness), and how grey (0: the stones' own hue, 1: grey). The dry styles have no mortar, but their gaps are filled the same colour, a
// little darker (88% of it) and set well back, so every building's joints are one family, never tar-black.
export const MORTARS = {
  lime: { label: 'Light lime', abs: [0.78, 0.76, 0.7] },
  grey: { label: 'Grey', light: 0.8, grey: 0.6, warm: 1 },
  dark: { label: 'Dark', light: 0.45, grey: 0.4, warm: 1 },
};
const G = -0.12;                               // walls start 12 cm under the ground, so the bottom row is half buried

// ── the styles ────────────────────────────────────────────────────────────────────────────────────────────────────────
// recess: how far the backing (mortar, or the dark core of a dry wall) sits behind the wall's outline, metres
// rim: how far a stone's edge stands in front of the backing (lowest, highest); tilt: how much a stone leans (m per m)
// bulge: (mortared) how far the bulge comes out, as a share of the stone's shorter side (lowest, highest), plus up to
//   `stick` metres more, stone by stone; (drystack, ledgestone) bulgeK: how far, per metre of stone size
// ring: a ring of corners just inside the outline that carries the stone's face, while the outline itself sits down on
//   the backing, so the stone has a side all round and nothing shows behind it, seen edge on (a dry stone or a slab
//   stands well out from the wall). k, max: how far in the ring is (share of the stone's half width, at most max
//   metres); faceK: how much of the bulge the ring lifts the face; faceAdd: metres more, between these two, per stone.
//   Three triangles a corner instead of one.
// joint: the gap between stones, times the "joint width" slider; fill: the mortar's colour times this, for the backing
// (a dry wall's gaps a little darker than a mortared wall's joints); value: how much lighter or darker one stone is
// than the next
export const STYLES = {
  mortared: { label: 'Mortared', recess: 0.035, rim: [0.002, 0.012], tilt: 0.07, bulge: [0.15, 0.2], stick: 0.03, ring: null, joint: 1, maxN: 7, coreAO: 0.8, rimAO: 0.85, value: 0.16, shadow: true, fill: 1 },
  drystack: { label: 'Dry-stacked', recess: 0.09, rim: [0, 0.003], tilt: 0.07, bulgeK: 0.35, ring: { k: 0.24, max: 0.03, faceK: 0.5, faceAdd: [0.05, 0.11] }, joint: 0.45, maxN: 5, fill: 0.88, coreAO: 0.82, rimAO: 0.7, value: 0.14 },
  ledgestone: { label: 'Ledgestone', recess: 0.05, rim: [0, 0.002], tilt: 0.035, bulgeK: 0.06, ring: { k: 0.4, max: 0.01, faceK: 0, faceAdd: [0.03, 0.07] }, joint: 0.6, jointVar: true, maxN: 6, fill: 0.88, coreAO: 0.82, rimAO: 0.75, value: 0.1 },
};

// ONE PALETTE PER BUILDING (sRGB): a base colour most stones take, a second, a darker grey and a rust-tan. A stone takes one
// of them (base about 55 in 100, second 20, dark grey 13, rust-tan 12; the colour mix slider moves stones between base
// and second), is drifted slowly toward the second colour across the wall (a 2.6 m noise, so like stones gather in
// patches), and made lighter or darker by ONE number for all three channels: one number each would change its hue, and an
// earlier version did that and some stones came out purple.
export const PALETTES = {
  grey: { label: 'Grey', base: [0.62, 0.61, 0.58], second: [0.56, 0.55, 0.52], dark: [0.41, 0.405, 0.39], rust: [0.61, 0.53, 0.43] },
  buff: { label: 'Buff', base: [0.64, 0.595, 0.51], second: [0.58, 0.55, 0.48], dark: [0.42, 0.4, 0.36], rust: [0.62, 0.52, 0.4] },
  ochre: { label: 'Ochre and grey', base: [0.6, 0.585, 0.55], second: [0.65, 0.56, 0.42], dark: [0.4, 0.39, 0.37], rust: [0.6, 0.48, 0.37] },
  basalt: { label: 'Dark basalt', base: [0.36, 0.355, 0.35], second: [0.42, 0.41, 0.39], dark: [0.25, 0.245, 0.24], rust: [0.44, 0.38, 0.32] },
  brown: { label: 'Grey-brown', base: [0.53, 0.5, 0.46], second: [0.57, 0.525, 0.44], dark: [0.34, 0.32, 0.29], rust: [0.55, 0.47, 0.38] },
};

// ── the shapes: blocks of wall (a footprint outline, bottom and top, standing from y0 to y1), openings, a top ─────────────
// A footprint outline runs round so the outside is on its right as you walk it (seen from above), starting with the face
// the camera sees first. An opening sits on one face: u is its middle, metres along the face from the face's first
// corner. A through opening goes right through the wall (and shows on the face opposite); otherwise it is a recess.
const rect = (W, D, cx = 0, cz = 0) => [[cx - W / 2, cz + D / 2], [cx + W / 2, cz + D / 2], [cx + W / 2, cz - D / 2], [cx - W / 2, cz - D / 2]];
// the top of a block: a rectangle (plus overhang) with which of its sides are on the outside (a lip is drawn there)
const topRect = (x0, x1, z0, z1, over, open = { x0: 1, x1: 1, z0: 1, z1: 1 }) => ({ x0: x0 - (open.x0 ? over : 0), x1: x1 + (open.x1 ? over : 0), z0: z0 - (open.z0 ? over : 0), z1: z1 + (open.z1 ? over : 0), open,
  ov: { x0: open.x0 ? over : 0, x1: open.x1 ? over : 0, z0: open.z0 ? over : 0, z1: open.z1 ? over : 0 } });

export const SHAPES = {
  wall: { label: 'Wall', note: 'a straight wall with a door and a window', make() {
    const L = 6, t = 0.45, H = 2.6, ct = 0.17, over = 0.12;
    return { H, sections: [{ loop0: rect(L, t), loop1: rect(L, t), y0: G, y1: H - ct }],
      openings: [{ face: 0, u: 1.7, w: 1.0, v0: G, v1: 2.05, kind: 'door', through: true, t, back: 2 },
        { face: 0, u: 4.25, w: 0.85, v0: 1.0, v1: 1.85, kind: 'window', through: true, t, back: 2 }],
      top: { y: H, t: ct, over, rects: [topRect(-L / 2, L / 2, -t / 2, t / 2, over)] } };
  } },
  corner: { label: 'Corner', note: 'an outside corner: two walls meeting', make() {
    const A = 3.6, B = 2.8, t = 0.45, H = 2.3, ct = 0.17, o = 0.12, x = 1.2, z = 1.0;   // (the corner a little off the middle)
    const loop = [[-A, 0], [0, 0], [0, -B], [-t, -B], [-t, -t], [-A, -t]].map(([a, b]) => [a + x, b + z]);
    return { H, sections: [{ loop0: loop, loop1: loop, y0: G, y1: H - ct }], openings: [],
      // (three pieces of top that meet edge to edge: the arm going left, the corner, the arm going back; the outside
      // faces overhung, the inside faces flush, so the two arms' copings meet cleanly in the inside corner)
      top: { y: H, t: ct, over: o, rects: [
        topRect(x - A, x - t, z - t, z, o, { x0: 1, x1: 0, z0: 0, z1: 1 }),
        topRect(x - t, x, z - t, z, o, { x0: 0, x1: 1, z0: 0, z1: 1 }),
        topRect(x - t, x, z - B, z - t, o, { x0: 0, x1: 1, z0: 1, z1: 0 })] } };
  } },
  chimney: { label: 'Chimney', note: 'a wide base, a shoulder stepped in three times, a narrower stack', make(o) {
    const W = 1.7, D = 0.95, w = 1.0, d = 0.72, H = 5.4, ct = 0.14, ov = 0.08;
    if (o.style === 'drystack') {
      // a dry chimney leans in steadily all the way up (about 1 in 10 on its front), rough capstones, a stovepipe
      const Hd = 4.6, tw = 0.86, td = 0.66;
      return { H: Hd, sections: [{ loop0: rect(W, 1.0), loop1: rect(tw, td), y0: G, y1: Hd - ct }], openings: [],
        top: { y: Hd, t: 0.1, over: -0.01, rough: true, rects: [topRect(-tw / 2, tw / 2, -td / 2, td / 2, -0.01)], holes: [[-0.11, 0.11, -0.11, 0.11]] },
        pipe: { x: 0, z: 0, r: 0.085, h: 0.45 } };
    }
    // the shoulder: three steps in, each a row of the same stones laid on a slope (about 50 degrees on the front, their
    // tops shedding the rain) with a level row on it
    const yS = 1.6, nS = 3, slope = 0.14, level = 0.2, at = (i) => rect(W - (W - w) * i / nS, D - (D - d) * i / nS);
    const sections = [{ loop0: rect(W, D), loop1: rect(W, D), y0: G, y1: yS }];
    let y = yS;
    for (let i = 1; i <= nS; i++) {
      sections.push({ loop0: at(i - 1), loop1: at(i), y0: y, y1: y + slope }); y += slope;
      if (i < nS) { sections.push({ loop0: at(i), loop1: at(i), y0: y, y1: y + level }); y += level; }
    }
    sections.push({ loop0: rect(w, d), loop1: rect(w, d), y0: y, y1: H - ct });
    return { H, sections, openings: [], top: { y: H, t: ct, over: ov, rects: [topRect(-w / 2, w / 2, -d / 2, d / 2, ov)], holes: [[-0.16, 0.16, -0.12, 0.12]] } };
  } },
  jail: { label: 'Jail', note: 'a stone block: four walls, a door and small windows, a flat top', palette: 'buff', stones: { size: 0.75, round: true }, make() {
    const W = 4.4, D = 3.4, H = 2.8, ct = 0.2, o = 0.12;
    return { H, sections: [{ loop0: rect(W, D), loop1: rect(W, D), y0: G, y1: H - ct }],
      steps: [{ face: 0, u: 1.45, w: 1.5, depth: 0.42, h: 0.17 }],          // a stone step at the door
      openings: [{ face: 0, u: 1.45, w: 0.95, v0: G, v1: 2.0, kind: 'door', depth: 0.2 },
        { face: 0, u: 3.3, w: 0.55, v0: 1.62, v1: 2.02, kind: 'window', depth: 0.22 },
        { face: 1, u: 1.7, w: 0.55, v0: 1.62, v1: 2.02, kind: 'window', depth: 0.22 }],
      top: { y: H, t: ct, over: o, rects: [topRect(-W / 2, W / 2, -D / 2, D / 2, o)] } };
  } },
  foundation: { label: 'Foundation', note: 'a stone footing under a building', make() {
    // (no coping: the top course is flush, and the building's sill sits right on it)
    const W = 5.6, D = 4.2, H = 0.62, inset = 0.02;
    return { H, sections: [{ loop0: rect(W, D), loop1: rect(W, D), y0: G, y1: H }], openings: [],
      top: { y: H, t: 0, over: 0, rects: [] },
      building: { x0: -W / 2 + inset, x1: W / 2 - inset, z0: -D / 2 + inset, z1: D / 2 - inset, y: H } };
  } },
  fieldwall: { label: 'Field wall', note: 'a low wall, thicker at the foot', make() {
    const L = 7, b = 0.64, t = 0.46, H = 1.05, ct = 0.15, o = 0.1;
    const tt = b + (t - b) * (H - ct - G) / (H - G);    // its thickness where the coping sits
    return { H, sections: [{ loop0: rect(L, b), loop1: rect(L, tt), y0: G, y1: H - ct }], openings: [],
      top: { y: H, t: ct, over: o, rects: [topRect(-L / 2, L / 2, -tt / 2, tt / 2, o)] } };
  } },
};

// ── 2D polygons with a flag on every edge ───────────────────────────────────────────────────────────────────────────
// A polygon is { p: [[u, v], ...] (anticlockwise), f: [flag, ...] } where f[i] belongs to the edge from p[i] to p[i+1].
// The flags say what happens along that edge: a joint (shrunk back to leave a mortar gap), the outline (left alone), a
// fold round a corner, or a side to draw ("skirt": into the wall, or down from a coping stone).
const J = { inset: 1 };                                   // a joint between two stones
const JJ = { inset: 2 };                                  // a joint the other stone doesn't shrink back from (twice as far)
const OUT = { inset: 0 };                                 // the outline, left as it is
const FOLD = { inset: 0, fold: true };                    // where a stone folds round a corner
const TIGHT = { inset: 1, tight: true };                  // a joint at an inside corner: straight, never chipped
const skirtIn = (depth) => ({ inset: 0, skirt: depth, dir: 'in' });
const skirtDown = (depth, soffit = 0) => ({ inset: 0, skirt: depth, dir: 'down', soffit });

function area(P) { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function centroid(P) {
  let a = 0, cx = 0, cy = 0; const n = P.length;
  for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  if (Math.abs(a) < 1e-12) { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / n, y / n]; }
  return [cx / (3 * a), cy / (3 * a)];
}
function bbox(P) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const p of P) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; }
// drop repeated points (an edge of no length)
function tidy(q) {
  const p = [], f = [], n = q.p.length;
  for (let i = 0; i < n; i++) {
    const a = q.p[i], b = q.p[(i + 1) % n];
    if (Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7) continue;
    p.push(a); f.push(q.f[i]);
  }
  return { p, f };
}
// keep the part of a polygon where nx*u + ny*v <= c; the new edge along the line gets flag nf
function clip(q, nx, ny, c, nf) {
  const P = q.p, F = q.f, n = P.length, p = [], f = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) {
      p.push(a); f.push(F[i]);
      if (db > 0) { const t = da / (da - db); p.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); f.push(nf); }
    } else if (db <= 0) {
      const t = da / (da - db); p.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); f.push(F[i]);
    }
  }
  return tidy({ p, f });
}
// a polygon the other way round (and its edge flags with it)
function reverse(q) { const n = q.p.length; return { p: q.p.slice().reverse(), f: q.p.map((_, i) => q.f[(2 * n - 2 - i) % n]), proud: q.proud, drip: q.drip }; }
// knock corner i off a polygon, c metres back along the edge before it and c2 along the edge after (the new short edge
// is a joint)
function chip(q, i, c, c2 = c) {
  const n = q.p.length, P = q.p[i], A = q.p[(i - 1 + n) % n], B = q.p[(i + 1) % n];
  const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
  const ca = Math.min(c, 0.4 * la), cb = Math.min(c2, 0.4 * lb); if (ca < 0.004 || cb < 0.004) return;
  const a = [P[0] + (A[0] - P[0]) * ca / la, P[1] + (A[1] - P[1]) * ca / la], b = [P[0] + (B[0] - P[0]) * cb / lb, P[1] + (B[1] - P[1]) * cb / lb];
  q.p.splice(i, 1, a, b); q.f.splice(i, 1, J, q.f[i]);
}

// pull every joint edge in by half the joint width (by the whole width for JJ), so the mortar shows between stones;
// then merge the shortest joint edges away until the stone has at most maxN sides and none shorter than minEdge
function finish(q, jw, maxN, minEdge) {
  const P0 = q.p, F0 = q.f, n = P0.length;
  for (let i = 0; i < n; i++) {
    const fl = F0[i]; if (!fl.inset || jw <= 0) continue;
    const a = P0[i], b = P0[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1e-9) continue;
    const nx = -dy / L, ny = dx / L, d = jw / 2 * fl.inset;          // (nx, ny) points inward
    q = clip(q, -nx, -ny, -(nx * a[0] + ny * a[1]) - d, fl);
    if (q.p.length < 3) return null;
  }
  const p = q.p.slice(), f = q.f.slice();
  while (p.length > 3) {
    let bi = -1, bl = Infinity;
    for (let i = 0; i < p.length; i++) {
      if (!f[i].inset) continue;
      const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < bl) { bl = L; bi = i; }
    }
    if (bi < 0 || (bl >= minEdge && p.length <= maxN)) break;
    const j = (bi + 1) % p.length, m = [(p[bi][0] + p[j][0]) / 2, (p[bi][1] + p[j][1]) / 2];
    if (j === 0) { p[0] = m; p.pop(); f.pop(); } else { p[bi] = m; p.splice(j, 1); f.splice(bi, 1); }
  }
  if (p.length < 3 || Math.abs(area(p)) < 2e-4) return null;
  return { p, f };
}

// ── a block of wall unrolled into a strip ─────────────────────────────────────────────────────────────────────────────
// C[k]: where corner k sits along the strip (metres, measured half way up); convex[k]: an outside corner (stones fold
// round it) or an inside one (stones are cut there)
function makeSection(S, isBottom, isTop) {
  const n = S.loop0.length, mid = S.loop0.map((p, i) => [(p[0] + S.loop1[i][0]) / 2, (p[1] + S.loop1[i][1]) / 2]);
  const C = [0];
  for (let k = 0; k < n; k++) { const a = mid[k], b = mid[(k + 1) % n]; C.push(C[k] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const convex = mid.map((p, k) => {
    const a = mid[(k - 1 + n) % n], b = mid[(k + 1) % n], d1 = [p[0] - a[0], p[1] - a[1]], d2 = [b[0] - p[0], b[1] - p[1]];
    return d1[0] * d2[1] - d1[1] * d2[0] < 0;
  });
  const prism = S.loop0.every((p, i) => p[0] === S.loop1[i][0] && p[1] === S.loop1[i][1]);
  // how much longer each face is up its slope than it is tall (1 on a plumb face): the texture is laid by that, so it
  // isn't stretched on a sloped face
  const fv = S.loop0.map((a, k) => {
    const b = S.loop0[(k + 1) % n], c = S.loop1[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const inset = Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / L;
    return Math.sqrt(1 + (inset / (S.y1 - S.y0)) ** 2);
  });
  return { ...S, n, C, P: C[n], convex, prism, isBottom, isTop, fv };
}
function faceAt(sec, u) {
  const P = sec.P, uu = ((u % P) + P) % P;
  for (let k = 0; k < sec.n; k++) if (uu < sec.C[k + 1]) return k;
  return sec.n - 1;
}
// a point on the strip (u along, v = height) on face k: its place in the world and the face's outward normal there
function mapStrip(sec, u, v, k) {
  const P = sec.P, n = sec.n, k1 = (k + 1) % n, Ck = sec.C[k], Ck1 = sec.C[k + 1];
  const uu = u - Math.round((u - (Ck + Ck1) / 2) / P) * P;            // the copy of u nearest face k
  const s = (uu - Ck) / (Ck1 - Ck), t = (v - sec.y0) / (sec.y1 - sec.y0);
  const A0 = sec.loop0[k], B0 = sec.loop0[k1], A1 = sec.loop1[k], B1 = sec.loop1[k1];
  const ax = A0[0] + (B0[0] - A0[0]) * s, az = A0[1] + (B0[1] - A0[1]) * s, bx = A1[0] + (B1[0] - A1[0]) * s, bz = A1[1] + (B1[1] - A1[1]) * s;
  const ex = (B0[0] - A0[0]) * (1 - t) + (B1[0] - A1[0]) * t, ez = (B0[1] - A0[1]) * (1 - t) + (B1[1] - A1[1]) * t;
  const gx = bx - ax, gy = sec.y1 - sec.y0, gz = bz - az;
  let nx = -ez * gy, ny = ez * gx - ex * gz, nz = ex * gy; const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
  return [ax + (bx - ax) * t, v, az + (bz - az) * t, nx, ny, nz];
}
// the footprint outline moved in by d (each corner where the two moved sides meet)
function offsetLoop(loop, d) {
  const n = loop.length, nrm = [];
  for (let k = 0; k < n; k++) { const a = loop[k], b = loop[(k + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); nrm.push([dz / L, -dx / L]); }   // inward
  return loop.map((p, k) => { const n1 = nrm[(k - 1 + n) % n], n2 = nrm[k], s = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]); return [p[0] + (n1[0] + n2[0]) * s, p[1] + (n1[1] + n2[1]) * s]; });
}

// ── mortared: random rubble brought to rough courses ────────────────────────────────────────────────────────────────
// THE COURSE LINES: one wandering line per bed joint, all the way round the strip (a height every 5 cm), each course
// 14 to 34 cm tall at the default stone size (0.6 to 1.4 times the mean), its bed tilting up and down every half metre
// or so (4 to 8 degrees). Where an opening needs a level bed (the top of every
// opening, the top of a window's sill) the nearest line is pinned flat there and eased back into its wander either side.
function courses(sec, ops, o, R) {
  const P = sec.P, N = Math.max(8, Math.round(P / 0.05)), dx = P / N, s = o.size;
  const hMin = 0.48 * s, hMax = 1.12 * s, amp = 0.015 + 0.06 * o.irregularity;
  const lines = [new Float64Array(N).fill(sec.y0)];
  for (let base = sec.y0; ;) {
    const h = hMin + (hMax - hMin) * R();
    if (sec.y1 - (base + h) < 0.9 * hMin) break;                    // (no thin row of crumbs under the cap: the last row takes it)
    base += h;
    const K = Math.max(2, Math.round(P / (0.35 + 0.3 * R()))), vals = Array.from({ length: K }, () => R() * 2 - 1), L = new Float64Array(N);
    for (let j = 0; j < N; j++) { const t = j / N * K, i0 = Math.floor(t), f = t - i0, a = vals[i0 % K], b = vals[(i0 + 1) % K]; L[j] = base + amp * (a + (b - a) * (1 - Math.cos(f * Math.PI)) / 2); }
    lines.push(L);
  }
  // EACH FACE ITS OWN: every bed line lifted or dropped up to 22% of a row in the middle of each face, fading out toward
  // its corners (where the corner stones need one bed for both faces), so the rows break at different heights face by face
  for (let i = 1; i < lines.length; i++) {
    const offs = Array.from({ length: sec.n }, () => (R() * 2 - 1) * 0.22 * (hMin + hMax) / 2), L = lines[i];
    for (let j = 0; j < N; j++) { const u = j * dx, k = faceAt(sec, u), dc = Math.min(u - sec.C[k], sec.C[k + 1] - u); L[j] += offs[k] * smooth(dc, 0.12, 0.4); }
  }
  lines.push(new Float64Array(N).fill(sec.y1));
  const nl = lines.length, at = (L, u) => { const t = (((u / dx) % N) + N) % N, j = Math.floor(t), f = t - j; return L[j % N] + (L[(j + 1) % N] - L[j % N]) * f; };
  const pinned = lines.map(() => new Uint8Array(N));
  const dist = (u, a, b) => { let d = Infinity; for (const sh of [-P, 0, P]) { const x = u + sh; d = Math.min(d, x < a ? a - x : x > b ? x - b : 0); } return d; };
  const meanOver = (L, a, b) => { let m = 0, c = 0; for (let u = a; u <= b + 1e-9; u += dx) { m += at(L, u); c++; } return m / Math.max(1, c); };
  const pin = (T, a, b, above) => {
    let best = -1, bd = Infinity;
    for (let i = above + 1; i < nl - 1; i++) { const d = Math.abs(meanOver(lines[i], a, b) - T); if (d < bd) { bd = d; best = i; } }
    if (best < 0) return -1;
    const L = lines[best];
    for (let j = 0; j < N; j++) { const d = dist(j * dx, a, b), w = 1 - smooth(d, 0, 0.5); if (w > 0) L[j] += (T - L[j]) * w; if (d <= 0) pinned[best][j] = 1; }
    return best;
  };
  // the openings: how far the lintel reaches past each side, how far the sill; then the pinned lines
  const S = [];
  for (const op of ops) {
    const ua = sec.C[op.face] + op.u - op.w / 2, ub = ua + op.w, door = op.v0 <= sec.y0 + 1e-6;
    const la = ua - s * (0.5 + 0.17 * R()), lb = ub + s * (0.5 + 0.17 * R()), sa = ua - s * (0.2 + 0.15 * R()), sb = ub + s * (0.2 + 0.15 * R());
    const iva = door ? 0 : pin(op.v0, sa - 0.15, sb + 0.15, 0);
    const ivb = pin(op.v1, la - 0.15, lb + 0.15, Math.max(0, iva));
    if (iva < 0 || ivb < 0) continue;                               // (no course lines to hang it on: left out)
    S.push({ op, ua, ub, la, lb, sa, sb, door, iva, ivb });
  }
  // every course at least 7 cm tall everywhere (where pins squeezed them)
  const minB = 0.07;
  for (let i = 1; i < nl - 1; i++) for (let j = 0; j < N; j++) if (!pinned[i][j] && lines[i][j] < lines[i - 1][j] + minB) lines[i][j] = lines[i - 1][j] + minB;
  for (let i = nl - 2; i >= 1; i--) for (let j = 0; j < N; j++) if (!pinned[i][j] && lines[i][j] > lines[i + 1][j] - minB) lines[i][j] = lines[i + 1][j] - minB;
  // the lintel's top: the line nearest 27 cm over the opening (at least 20); the sill's bottom: the first 7 cm under it
  for (const X of S) {
    X.ilt = nl - 1; let bd = Infinity;
    for (let i = X.ivb + 1; i < nl; i++) { const m = meanOver(lines[i], X.la, X.lb) - X.op.v1; if (m >= 0.2 * s / 0.3 && Math.abs(m - 0.27 * s / 0.3) < bd) { bd = Math.abs(m - 0.27 * s / 0.3); X.ilt = i; } }
    if (!X.door) { X.isb = 0; for (let i = X.iva - 1; i >= 0; i--) if (meanOver(lines[i], X.sa, X.sb) <= X.op.v0 - 0.22 * s) { X.isb = i; break; } }
  }
  return { lines, nl, at, S, dx, N };
}

// A JOINT is a slanting line: x(y) = u + s (y - y0). Stones either side of it share it, so the joint keeps its width
// however it slants. A stone in a course reaches from its left joint to its right one, between two course lines.
function layoutCoursed(sec, ops, o, R) {
  const s = o.size, P = sec.P, n = sec.n, C = sec.C;
  const { lines, nl, at, S } = courses(sec, ops, o, R), nb = nl - 1, out = [];
  const jMid = (u, b) => (at(lines[b], u) + at(lines[b + 1], u)) / 2;
  const joint = (u, b, sl = (R() - 0.5) * 0.5) => ({ u, s: sl, y: jMid(u, b) });
  const yOf = (L, x) => (typeof L === 'function' ? L(x) : at(L, x));          // (a course line, or a split stone's own)
  const onLine = (Jt, L) => { let x = Jt.u, y = yOf(L, x); for (let it = 0; it < 3; it++) { x = Jt.u + Jt.s * (y - Jt.y); y = yOf(L, x); } return [x, y]; };
  const shiftJ = (Jt, d) => ({ u: Jt.u + d, s: Jt.s, y: Jt.y });
  const hBand = [];
  for (let b = 0; b < nb; b++) { let m = 0; for (let j = 0; j < 24; j++) { const u = P * j / 24; m += at(lines[b + 1], u) - at(lines[b], u); } hBand.push(Math.max(m / 24, 0.55 * s)); }

  // a rubble stone between joints jl and jr, from line Lb up to line Lt (course lines, or a split stone's own line);
  // force: corners to knock off by a set amount (where a little wedge stone sits in the joint)
  const rubble = (jl, jr, Lb, Lt, fB, fR, fT, fL, chipK, force = {}) => {
    const BL = onLine(jl, Lb), BR = onLine(jr, Lb), TR = onLine(jr, Lt), TL = onLine(jl, Lt);
    if (BR[0] - BL[0] < 0.03 || TR[0] - TL[0] < 0.03) return null;
    const p = [BL], f = [fB];
    // a middle point where the course line sags below the straight bottom edge (or rises above the top), so the stone
    // follows its bed and stays convex
    const mb = (BL[0] + BR[0]) / 2, yb = yOf(Lb, mb); if (yb < (BL[1] + BR[1]) / 2 - 0.004) { p.push([mb, yb]); f.push(fB); }
    p.push(BR); f.push(fR); p.push(TR); f.push(fT);
    const mt = (TL[0] + TR[0]) / 2, yt = yOf(Lt, mt); if (yt > (TL[1] + TR[1]) / 2 + 0.004) { p.push([mt, yt]); f.push(fT); }
    p.push(TL); f.push(fL);
    const q = { p, f };
    // ODD SHAPES: each corner pulled in a little, its own way (so no edge runs dead level or plumb: 5 to 15 degrees off),
    // then two or three corners knocked off, each cut its own length along each side (so the cuts lie at all angles).
    // Never beside an opening (its edge stays straight).
    const h = Math.min(TL[1] - BL[1], TR[1] - BR[1]), ci = [], forced = [], n0 = q.p.length;
    [[BL, 1, 1, 'BL'], [BR, -1, 1, 'BR'], [TR, -1, -1, 'TR'], [TL, 1, -1, 'TL']].forEach(([C0, su, sv, nm]) => {
      const i = q.p.indexOf(C0), prev = q.f[(i - 1 + n0) % n0], next = q.f[i];
      if (prev.skirt || next.skirt || prev.tight || next.tight) return;
      if (force[nm]) { forced.push([i, nm]); return; }
      q.p[i] = [C0[0] + su * h * 0.06 * R() * chipK, C0[1] + sv * h * 0.05 * R() * chipK];
      ci.push(i);
    });
    // two or three corners knocked off (on half the stones one of them a big cut, 20 to 35% of the stone's height), so
    // every stone has five to seven corners, each turning well over 20 degrees
    const nChip = R() < 0.15 ? 1 : R() < 0.65 ? 2 : 3, bigOne = R() < 0.5;
    for (let i = ci.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = ci[i]; ci[i] = ci[j]; ci[j] = t; }   // (shuffled: the same on every browser)
    const cuts = ci.slice(0, nChip).map((i, k) => [i, k === 0 && bigOne ? 0.2 + 0.15 * R() : 0.06 + 0.12 * R()]);
    // (a wedge stone's corner: cut the wedge's size along the bed, a little more up the joint)
    for (const [i, nm] of forced) { const r = force[nm]; cuts.push([i, 0, nm === 'BR' ? [r + 0.006, r * 1.3] : [r * 1.3, r + 0.006]]); }
    cuts.sort((a, b2) => b2[0] - a[0]).forEach(([i, k, fixed]) => {
      if (fixed) { chip(q, i, fixed[0], fixed[1]); return; }
      const lo = R() < 0.5; chip(q, i, h * chipK * (lo ? k : k * (0.3 + 0.4 * R())), h * chipK * (lo ? k * (0.3 + 0.4 * R()) : k));
    });
    return q;
  };

  // the lintel over each opening and the sill under each window, fitted to the course lines
  for (const X of S) {
    const vb = X.op.v1, REV = skirtIn(X.op.reveal), Lt = lines[X.ilt];
    X.ljl = { u: X.la, s: (R() - 0.5) * 0.35, y: vb }; X.ljr = { u: X.lb, s: (R() - 0.5) * 0.35, y: vb };
    const TL = onLine(X.ljl, Lt), TR = onLine(X.ljr, Lt), p = [[X.la, vb], [X.ua, vb], [X.ub, vb], [X.lb, vb], TR], f = [OUT, REV, OUT, J, J];
    const mt = (TL[0] + TR[0]) / 2, yt = at(Lt, mt); if (yt > (TL[1] + TR[1]) / 2 + 0.004) { p.push([mt, yt]); f.push(J); }
    p.push(TL); f.push(J);
    const q = { p, f, proud: 0.008, light: 1.08 };
    for (const i of [p.length - 1, 4].filter(() => R() < 0.8)) chip(q, i, s * (0.05 + 0.12 * R()), s * (0.03 + 0.08 * R()));
    out.push(q);
    if (X.door) continue;
    const va = X.op.v0, Lb = lines[X.isb], lip = skirtIn(0.07), ledge = skirtIn(0.045);
    X.sjl = { u: X.sa, s: (R() - 0.5) * 0.3, y: va }; X.sjr = { u: X.sb, s: (R() - 0.5) * 0.3, y: va };
    const BL = onLine(X.sjl, Lb), BR = onLine(X.sjr, Lb), sp = [BL], sf = [lip];
    const mb = (BL[0] + BR[0]) / 2, yb = at(Lb, mb); if (yb < (BL[1] + BR[1]) / 2 - 0.004) { sp.push([mb, yb]); sf.push(lip); }
    sp.push(BR, [X.sb, va], [X.ub, va], [X.ua, va], [X.sa, va]); sf.push(lip, ledge, REV, ledge, lip);
    out.push({ p: sp, f: sf, proud: 0.036, kind: 'sill', light: 1.05 });
  }
  // what is in the way in course b: openings, lintels, sills, inside corners
  const excl = (b) => {
    const E = [];
    for (const X of S) {
      if (b >= X.iva && b < X.ivb) E.push({ u0: X.ua, u1: X.ub, kind: 'hole', X, jl: { u: X.ua, s: 0, y: 0 }, jr: { u: X.ub, s: 0, y: 0 } });
      if (b >= X.ivb && b < X.ilt) E.push({ u0: X.la, u1: X.lb, kind: 'lintel', X, jl: X.ljl, jr: X.ljr });
      if (!X.door && b >= X.isb && b < X.iva) E.push({ u0: X.sa, u1: X.sb, kind: 'sill', X, jl: X.sjl, jr: X.sjr });
    }
    for (let k = 0; k < n; k++) if (!sec.convex[k]) E.push({ u0: C[k], u1: C[k], kind: 'cut', k, jl: { u: C[k], s: 0, y: 0 }, jr: { u: C[k], s: 0, y: 0 } });
    return E;
  };
  const overlaps = (a0, a1, b0, b1) => [-P, 0, P].some((sh) => a0 < b1 + sh - 1e-6 && a1 > b0 + sh + 1e-6);

  // the faces between outside corners: narrow enough that one corner stone runs right across ("through"), that the two
  // corners' stones share it ("split"), or wide (a long or short corner stone at each end, ordinary stones between)
  const QL = (k) => Math.min(1.17 * s, 0.3 * (C[k + 1] - C[k])), QS = (k) => Math.min(0.6 * s, 0.18 * (C[k + 1] - C[k]));
  const kind = [];
  for (let k = 0; k < n; k++) {
    const w = C[k + 1] - C[k], both = sec.convex[k] && sec.convex[(k + 1) % n];
    kind[k] = !both ? 'wide' : w < 1.7 * s ? 'through' : w < 2.1 * s ? 'split' : 'wide';
  }
  const linked = kind.map((x) => x !== 'wide'), chains = [];
  if (linked.every(Boolean)) chains.push({ ring: true, verts: [...Array(n).keys()] });
  else for (let k = 0; k < n; k++) {
    if (!sec.convex[k] || linked[(k - 1 + n) % n]) continue;
    const verts = [k]; let j = k; while (linked[j]) { j = (j + 1) % n; verts.push(j); }
    chains.push({ ring: false, verts });
  }

  const blocked = Array.from({ length: nb + 1 }, () => []);   // stones two courses tall, reaching up into course b
  // whose turn it is at each inside corner, course by course ('L': the face before the corner, 'R': the one after)
  const cutSide = {}, cutTurn = (k, b) => cutSide[k + ':' + b] ?? (cutSide[k + ':' + b] = (b + k) % 2 === 0 ? 'L' : 'R');
  const REACH = 0.03;                                          // how far past the corner line the turn's stone runs
  let below = [];                                             // where the joints of the course below fall
  const jit = (x) => x * (0.85 + 0.3 * R());
  for (let b = 0; b < nb; b++) {
    const hl = hBand[b], E = excl(b), E1 = b + 1 < nb ? excl(b + 1) : null, occ = [...blocked[b], ...E];
    const stones = [];                                        // [jl, jr, top line, kind, flags...]
    // can a stone over u0..u1 go on up through the next course too?
    const canJump = (u0, u1) => E1 && b + 2 <= nb - 0 && !E1.some((e) => overlaps(u0, u1, e.u0, e.u1));
    // CORNER STONES: as the chains say, long and short in turn; trimmed to keep out of anything already in this course
    for (const ch of chains) {
      const segs = [];
      if (ch.ring) {
        const sp = ch.verts.map((k) => joint(C[k] + (C[k + 1] - C[k]) * (0.5 + ((b + k) % 2 ? 0.15 : -0.15) + (R() - 0.5) * 0.08), b));
        ch.verts.forEach((k, i) => segs.push({ jl: i ? sp[i - 1] : shiftJ(sp[n - 1], -P), jr: sp[i], cs: [C[k]] }));
      } else {
        let start = null, cs = [];
        ch.verts.forEach((k, i) => {
          const longFirst = (b + i) % 2 === 0, Ck = C[k] + (k < ch.verts[0] ? P : 0), kb = (k - 1 + n) % n;
          if (start === null) { start = joint(Ck - jit(longFirst ? QL(kb) : QS(kb)), b); cs = []; }
          cs.push(Ck);
          if (i === ch.verts.length - 1) { segs.push({ jl: start, jr: joint(Ck + jit(longFirst ? QS(k) : QL(k)), b), cs }); return; }
          if (kind[k] === 'through') return;
          const sp = joint(Ck + (C[k + 1] - C[k]) * (0.5 + (b % 2 ? 0.14 : -0.14) + (R() - 0.5) * 0.08), b);
          segs.push({ jl: start, jr: sp, cs }); start = sp; cs = [];
        });
      }
      for (const sg of segs) {
        let { jl, jr } = sg, drop = false;
        for (const r of occ) for (const sh of [-P, 0, P]) {
          const a = r.u0 + sh, z = r.u1 + sh;
          if (z <= jl.u + 1e-6 || a >= jr.u - 1e-6) continue;
          if (sg.cs.some((c) => c >= a - 1e-6 && c <= z + 1e-6)) { drop = true; continue; }
          if (sg.cs.every((c) => c < a)) jr = shiftJ(r.jl, sh); else if (sg.cs.every((c) => c > z)) jl = shiftJ(r.jr, sh); else drop = true;
        }
        if (drop || jr.u - jl.u < 0.45 * hl) continue;
        const top = canJump(jl.u, jr.u) && R() < 0.5 ? b + 2 : b + 1;
        const st = { jl, jr, top, kind: 'quoin' };
        stones.push(st); occ.push({ u0: jl.u, u1: jr.u, jl, jr, kind: 'quoin' });
        if (top === b + 2) blocked[b + 1].push({ u0: jl.u, u1: jr.u, jl, jr, kind: 'jump' });
      }
    }
    // the gaps between what's placed: jamb stones beside an opening (long and short in turn), then ordinary stones 1.3 to
    // 3 times as long as the course is tall, their joints kept 6 cm or more from the joints of the course below
    const occN = occ.map((r) => { const sh = Math.floor(r.u0 / P) * P; return { ...r, u0: r.u0 - sh, u1: r.u1 - sh, jl: shiftJ(r.jl, -sh), jr: shiftJ(r.jr, -sh) }; }).sort((x, y) => x.u0 - y.u0);
    const gaps = [];
    if (!occN.length) { const j0 = joint(0, b); gaps.push([j0, shiftJ(j0, P), null, null]); }
    for (let i = 0; i < occN.length; i++) {
      const A = occN[i], B = i + 1 < occN.length ? occN[i + 1] : { ...occN[0], u0: occN[0].u0 + P, jl: shiftJ(occN[0].jl, P) };
      if (B.u0 - A.u1 > 0.01) gaps.push([A.jr, B.jl, A, B]);
    }
    const nearBelow = (x) => below.find((y) => Math.abs((((x - y) % P) + P + P / 2) % P - P / 2) < 0.1);
    for (const [ja, jb, A, B] of gaps) {
      let a = ja, z = jb;
      const pieces = [];
      const jambL = A && A.kind === 'hole', jambR = B && B.kind === 'hole';
      if (jambL) {
        const L = hl * ((b % 2) ? 1.5 : 0.95) * (0.9 + 0.2 * R());
        if (z.u - a.u - L < 0.8 * hl) { pieces.push([a, z, 'jamb']); a = z; } else { const jc = joint(a.u + L, b); pieces.push([a, jc, 'jamb']); a = jc; }
      }
      if (jambR && z.u - a.u > 0.01) {
        const L = hl * ((b % 2) ? 0.95 : 1.5) * (0.9 + 0.2 * R());
        if (z.u - a.u - L < 0.8 * hl) { pieces.push([a, z, 'jamb']); z = a; } else { const jc = joint(z.u - L, b); pieces.push([jc, z, 'jamb']); z = jc; }
      }
      const M = z.u - a.u;
      // (joints compared round the strip: the gap may sit a whole turn on from the stone beside it)
      const same = (x, y) => Math.abs((((x - y) % P) + P + P / 2) % P - P / 2) < 1e-7;
      const grow = M < 0.6 * hl && !pieces.length && (stones.find((x) => x.kind === 'quoin' && x.top === b + 1 && same(x.jr.u, a.u)) || stones.find((x) => x.kind === 'quoin' && x.top === b + 1 && same(x.jl.u, z.u)));
      if (grow) {
        if (same(grow.jr.u, a.u)) grow.jr = shiftJ(z, grow.jr.u - a.u); else grow.jl = shiftJ(a, grow.jl.u - z.u);
        const r = occ.find((x) => x.jl === grow.jl || x.jr === grow.jr); if (r) { r.u0 = grow.jl.u; r.u1 = grow.jr.u; }
        continue;
      }
      if (M > 0.01) {
        if (M < 0.7 * hl && pieces.length) {
          // too short for a stone of its own: the jamb stone beside it takes it
          const pc = pieces.find((x) => x[1] === a) || pieces.find((x) => x[0] === z);
          if (pc && pc[1] === a) pc[1] = z; else if (pc) pc[0] = a;
        } else {
          const k = Math.max(1, Math.round(M / ((o.round ? 1.2 : 1.55) * hl))), w = Array.from({ length: k }, () => 0.45 + 1.3 * R()), ws = w.reduce((x, y) => x + y, 0);
          let jp = a, acc = 0;
          for (let i = 0; i < k; i++) {
            let jn = z;
            if (i < k - 1) {
              acc += w[i]; let e = a.u + M * acc / ws;
              const bad = nearBelow(e); if (bad !== undefined) e += Math.sign((((e - bad) % P) + P + P / 2) % P - P / 2 || 1) * 0.12;
              jn = joint(clamp(e, jp.u + 0.6 * hl, z.u - 0.6 * hl), b);
            }
            pieces.push([jp, jn, 'field']); jp = jn;
          }
        }
      }
      for (const [jl, jr, kd] of pieces) {
        const top = kd === 'field' && jr.u - jl.u >= 0.9 * hl && canJump(jl.u, jr.u) && R() < 0.3 ? b + 2 : b + 1;
        stones.push({ jl, jr, top, kind: kd, A: jl === ja ? A : null, B: jr === jb ? B : null });
        if (top === b + 2) blocked[b + 1].push({ u0: jl.u, u1: jr.u, jl, jr, kind: 'jump' });
      }
    }
    // the stones themselves
    below = [];
    for (const r of [...stones, ...blocked[b]]) below.push(r.jl.u, r.jr.u);
    // WEDGES: where a joint meets the bed below it, now and then a small stone (a fifth to a third of a stone's size)
    // wedged into the corner the two stones either side leave for it
    stones.sort((x, y) => x.jl.u - y.jl.u);
    for (let i = 0; i + 1 < stones.length; i++) {
      const A = stones[i], B = stones[i + 1];
      if (A.jr !== B.jl || A.kind === 'jamb' || B.kind === 'jamb' || (b === 0 && sec.isBottom) || R() > 0.22) continue;
      const r = hl * (0.12 + 0.08 * R()), [x, y] = onLine(A.jr, lines[b]), d = (R() - 0.5) * r * 0.6;
      if (A.jr.u - A.jl.u < 4 * r || B.jr.u - B.jl.u < 4 * r) continue;
      A.force = { ...A.force, BR: r }; B.force = { ...B.force, BL: r };
      out.push({ p: [[x - r, y], [x + r, y], [x + d, y + r * (1.1 + 0.4 * R())]], f: [J, J, J], kind: 'wedge' });
    }
    for (const st of stones) {
      const onSill = S.some((X) => !X.door && X.iva === b && overlaps(st.jl.u, st.jr.u, X.sa, X.sb));
      const underLintel = S.some((X) => X.ivb === st.top && overlaps(st.jl.u, st.jr.u, X.la, X.lb));
      const fB = b === 0 && sec.isBottom ? OUT : onSill ? JJ : J, fT = underLintel ? JJ : J;
      let fL = st.A && st.A.kind === 'hole' ? skirtIn(st.A.X.op.reveal) : J, fR = st.B && st.B.kind === 'hole' ? skirtIn(st.B.X.op.reveal) : J;
      let jl = st.jl, jr = st.jr;
      // AN INSIDE CORNER: the two faces' stones take turns, course by course. The one whose turn it is runs on past the
      // corner line (into the corner, as far as the other face's stones stand back), the other butts up against it; both
      // edges straight there. (A stone two courses tall keeps its turn for the course above too.)
      if (st.B && st.B.kind === 'cut') {
        const win = cutTurn(st.B.k, b) === 'L'; if (win) jr = shiftJ(jr, REACH); fR = TIGHT;
        if (st.top === b + 2) cutSide[st.B.k + ':' + (b + 1)] = cutTurn(st.B.k, b);
      }
      if (st.A && st.A.kind === 'cut') {
        const win = cutTurn(st.A.k, b) === 'R'; if (win) jl = shiftJ(jl, -REACH); fL = TIGHT;
        if (st.top === b + 2) cutSide[st.A.k + ':' + (b + 1)] = cutTurn(st.A.k, b);
      }
      const K = st.kind === 'quoin' ? 0.5 : 1, mid = (jl.u + jr.u) / 2;
      // under a window sill, the rain runs off the sill's edge
      const X = S.find((x) => !x.door && st.top <= x.isb && overlaps(jl.u, jr.u, x.sa, x.sb)), drip = X ? at(lines[X.isb], mid) : undefined;
      // SPLIT: now and then a course-tall field stone is two smaller ones, one on the other, their bed tilting its own way
      if (st.kind === 'field' && st.top === b + 1 && jr.u - jl.u > 0.9 * hl && at(lines[b + 1], mid) - at(lines[b], mid) > 0.21 * s / 0.3 && R() < 0.2) {
        const f0 = 0.4 + 0.2 * R(), tilt = (R() - 0.5) * 0.25;
        const split = (u) => at(lines[b], u) + (at(lines[b + 1], u) - at(lines[b], u)) * f0 + tilt * (u - mid);
        const q1 = rubble(jl, jr, lines[b], split, fB, fR, J, fL, K, { BL: st.force?.BL, BR: st.force?.BR });
        const q2 = rubble(jl, jr, split, lines[b + 1], J, fR, fT, fL, K);
        for (const q of [q1, q2]) if (q) { q.drip = drip; out.push(q); }
        continue;
      }
      const q = rubble(jl, jr, lines[b], lines[st.top], fB, fR, fT, fL, K, st.force);
      if (!q) continue;
      if (st.kind === 'quoin') q.proud = 0.01 + 0.01 * R();
      q.drip = drip;
      out.push(q);
    }
  }
  return out;
}

// ── drystack and ledgestone: the mason's way ────────────────────────────────────────────────────────────────────────────
// the long stone over an opening and the sill under a window (the dry styles: plain shapes, set first)
function lintelBox(ua, ub, vb, s, R, REV) {
  const ovL = s * (0.55 + 0.45 * R()), ovR = s * (0.55 + 0.45 * R()), LH = s * (0.72 + 0.25 * R());
  const la = ua - ovL, lb = ub + ovR, top = vb + LH;
  return { p: [[la, vb], [ua, vb], [ub, vb], [lb, vb], [lb + s * 0.05 * R(), vb + LH * 0.5], [lb - s * 0.08 * R(), top], [la + (lb - la) * (0.3 + 0.4 * R()), top + s * 0.06 * R()], [la + s * 0.08 * R(), top], [la - s * 0.05 * R(), vb + LH * 0.45]],
    f: [OUT, REV, OUT, J, J, J, J, J, J], proud: 0.008 };
}
function sillBox(ua, ub, va, s, R, REV) {
  const sa = ua - s * 0.28, sb = ub + s * 0.28, hS = s * (0.3 + 0.1 * R()), lip = skirtIn(0.07), ledge = skirtIn(0.045);
  return { p: [[sa, va - hS], [sb, va - hS], [sb, va], [ub, va], [ua, va], [sa, va]], f: [lip, lip, ledge, REV, ledge, lip], proud: 0.032 };
}
// a field stone laid on its bed: a broken slab 1.4 to 3.5 times as long as it is tall, its bed and top nearly flat (within
// 5 degrees), its ends blunt: each corner knocked off once or twice, so an end is two or three flat facets, not round
function fieldSlab(R, sz, irr) {
  const asp = 1.4 + 2.1 * R(), L = sz * (0.8 + 0.9 * R()) * Math.sqrt(asp / 2.2), T = clamp(L / asp, 0.06, 0.32);
  const q = { p: [[0, 0], [L, 0], [L, T * (0.9 + 0.2 * R())], [0, T * (0.9 + 0.2 * R())]], f: [J, J, J, J] };
  for (let i = 3; i >= 0; i--) if (R() < 0.85) chip(q, i, T * (0.12 + 0.3 * R() * (0.5 + irr)), T * (0.1 + 0.25 * R() * (0.5 + irr)));
  return q.p;
}
// a ledgestone slab: 4 to 12 times as long as it is thick (one in ten shorter), 3 to 12 cm thick, one end 0.6 to 1.0 times
// as thick as the other (it tapers), its ends broken off at a slant (15 to 40 degrees) or with a notch; one in ten a
// chunky stone two to three times as thick; one in ten 90 cm or longer
function ledgeSlab(R, sz, irr, thick) {
  const k = sz / 0.3, T = thick ? (0.08 + 0.06 * R()) * k * (1 + R()) : (0.03 + 0.09 * Math.pow(R(), 1.3)) * k;
  let L = R() < 0.1 ? T * (2.5 + R()) : T * (4 + 8 * R()); if (R() < 0.1) L = Math.max(L, (0.9 + 0.3 * R()) * k);
  L = clamp(L, 0.12, 1.3 * k);
  const taper = 0.6 + 0.4 * R(), tl = R() < 0.5 ? T : T * taper, tr = tl === T ? T * taper : T;
  // the ends: slanting one way or the other, or a point (a notch) part way up
  const end = (x0, t, dir) => {
    const r = R(), sl = t * Math.tan((15 + 25 * R()) * Math.PI / 180);
    if (r < 0.4) return [[x0, 0], [x0 + dir * sl, t]];
    if (r < 0.8) return [[x0 + dir * sl, 0], [x0, t]];
    return [[x0 + dir * sl * 0.6, 0], [x0 - dir * t * 0.15, t * (0.35 + 0.3 * R())], [x0 + dir * sl * 0.6, t]];
  };
  const left = end(0, tl, 1), right = end(L, tr, -1);
  return hull([...left, ...right, [L * (0.35 + 0.3 * R()), (tl + tr) / 2 * (0.97 + 0.08 * R())]]);
}
function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const rot = (P, a) => { const c = Math.cos(a), s = Math.sin(a); return P.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
// a stone's underside and top, column by column (dx wide): its outline scaled to a whole number of columns
function profileOf(P, dx) {
  const b = bbox(P), cols = Math.max(1, Math.round((b[1] - b[0]) / dx)), k = cols * dx / Math.max(1e-6, b[1] - b[0]);
  const Q = P.map(([x, y]) => [(x - b[0]) * k, y - b[2]]), lo = new Float64Array(cols), hi = new Float64Array(cols);
  const span = (x) => {
    let a = Infinity, c = -Infinity;
    for (let i = 0, n = Q.length; i < n; i++) {
      const p = Q[i], q = Q[(i + 1) % n];
      if ((p[0] - x) * (q[0] - x) > 0 || p[0] === q[0]) continue;
      const y = p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]); if (y < a) a = y; if (y > c) c = y;
    }
    return a === Infinity ? null : [a, c];
  };
  // (a convex outline is lowest and highest within a column at the column's sides, or at a corner inside it)
  const edge = []; for (let j = 0; j <= cols; j++) edge.push(span(Math.min(cols * dx - 1e-6, Math.max(1e-6, j * dx))));
  for (let j = 0; j < cols; j++) {
    let a = Infinity, c = -Infinity;
    for (const s of [edge[j], edge[j + 1]]) if (s) { if (s[0] < a) a = s[0]; if (s[1] > c) c = s[1]; }
    for (const p of Q) if (p[0] >= j * dx && p[0] <= (j + 1) * dx) { if (p[1] < a) a = p[1]; if (p[1] > c) c = p[1]; }
    lo[j] = a === Infinity ? 0 : a; hi[j] = c === -Infinity ? 0 : c;
  }
  return { P: Q, lo, hi, cols, h: b[3] - b[2] };
}
function layoutPacked(sec, ops, o, R, ledge) {
  const P = sec.P, N = Math.max(16, Math.round(P / 0.02)), dx = P / N, s = o.size, irr = o.irregularity;
  const prof = new Float64Array(N).fill(sec.y0), stones = [], obst = [];
  const wrap = (j) => ((j % N) + N) % N;
  const overlapU = (a0, a1, b0, b1) => [-P, 0, P].some((sh) => a0 < b1 + sh && a1 > b0 + sh);
  // the openings first: the lintel and sill are set where they belong, and the stones are kept out of the opening
  for (const op of ops) {
    const ua = sec.C[op.face] + op.u - op.w / 2, ub = ua + op.w, REV = skirtIn(op.reveal);
    const lin = lintelBox(ua, ub, op.v1, s, R, REV), lb = bbox(lin.p); stones.push(lin);
    obst.push({ u0: lb[0], u1: lb[1], v0: op.v1, v1: lb[3] }, { u0: ua, u1: ub, v0: op.v0, v1: op.v1 });
    if (op.kind === 'window') { const sl = sillBox(ua, ub, op.v0, s, R, REV), sb = bbox(sl.p); stones.push(sl); obst.push({ u0: sb[0], u1: sb[1], v0: sb[2], v1: op.v0 }); }
  }
  const raise = (O) => { for (let j = Math.floor(O.u0 / dx); j < Math.ceil(O.u1 / dx); j++) prof[wrap(j)] = Math.max(prof[wrap(j)], O.v1); };
  const minH = ledge ? 0.03 : 0.05, tol = ledge ? 0.012 : 0.025;
  // THE PILE: forty stones to choose from, each measured once (its underside and top, at each way it may be turned).
  // Bigger stones low down, smaller higher up (as a dry wall is built), every size by the irregularity.
  const fromPile = (y) => {
    // (a dry wall: now and then a big stone, two to three times the rest, mostly in the bottom third)
    const big = !ledge && R() < (y < sec.y0 + 0.35 * (sec.y1 - sec.y0) ? 0.3 : 0.05) ? 2 + 0.6 * R() : 1;
    const sz = s * big * (ledge ? 1 : 1.2 - 0.4 * smooth(y, 0, 2.4)) * clamp(Math.exp(gauss(R) * (0.15 + 0.3 * irr)), 0.5, 1.8);
    const base = ledge ? ledgeSlab(R, sz, irr, R() < 0.1) : fieldSlab(R, sz, irr);
    // a dry stone laid on its bed or tipped up to 5 degrees either way; a ledgestone slab no more than 2 degrees
    return { base, angs: ledge ? [0, (R() - 0.5) * 0.07] : [0, 0.04 + 0.045 * R(), -0.04 - 0.045 * R()], S: [] };
  };
  const pile = []; for (let i = 0; i < 40; i++) pile.push(fromPile(sec.y0));
  // ONE OVER TWO: where each placed stone's ends are, and how high its top is there. A stone whose end would land within
  // 15 cm (10 on ledgestone) of an end of a stone it rests on is a poor fit (it would carry a joint straight up the wall)
  // (the ends kept in buckets along the wall, so a check only looks at the few nearby)
  const gapMin = ledge ? 0.1 : 0.15, nBk = Math.max(1, Math.floor(P / gapMin)), bk = Array.from({ length: nBk }, () => []);
  const bOf = (u) => ((Math.floor(u / P * nBk) % nBk) + nBk) % nBk;
  const wrapD = (a, b) => Math.abs((((a - b) % P) + P + P / 2) % P - P / 2);
  const near = (u, y) => { const c = bOf(u); for (const d of [-1, 0, 1]) for (const e of bk[(c + d + nBk) % nBk]) if (Math.abs(e.y - y) < 0.06 && wrapD(u, e.u) < gapMin) return true; return false; };
  const stacked = (us, ue, y) => near(us, y) || near(ue, y);
  const addEnd = (u, y) => bk[bOf(u)].push({ u, y });
  for (let guard = 0; guard < 30000; guard++) {
    // the lowest dip (looked for from a random place, so ties don't always go to the same end)
    const st = Math.floor(R() * N); let im = st;
    for (let j = 0; j < N; j++) { const i = (st + j) % N; if (prof[i] < prof[im] - 1e-9) im = i; }
    const ymin = prof[im]; if (ymin >= sec.y1 - 0.004) break;
    let a = im, b = im, cnt = 1;
    while (cnt < N && prof[wrap(a - 1)] <= ymin + tol) { a--; cnt++; }
    while (cnt < N && prof[wrap(b + 1)] <= ymin + tol) { b++; cnt++; }
    const W = (b - a + 1) * dx, u0 = a * dx, u1 = (b + 1) * dx;
    // the lowest opening part above the dip: if the gap under it is too small for a stone, it is reached
    let ceil = Infinity;
    for (const O of obst) if (O.v0 >= ymin - 0.01 && overlapU(u0, u1, O.u0, O.u1)) ceil = Math.min(ceil, O.v0);
    if (ceil - ymin < minH) { for (const O of obst) if (Math.abs(O.v0 - ceil) < 1e-9 && overlapU(u0, u1, O.u0, O.u1)) raise(O); continue; }
    let best = null;
    // how well a stone (measured S) sits here: the empty space left under it for its size, a little worse if it rests
    // high on the dip's shoulders, a little better if it fills the dip's width
    const tryStone = (S, pi) => {
      const starts = new Set([a, b + 1 - S.cols, Math.round((a + b + 1 - S.cols) / 2)]);
      for (const j0 of starts) {
        let y = -Infinity;
        for (let j = 0; j < S.cols; j++) y = Math.max(y, prof[wrap(j0 + j)] - S.lo[j]);
        const us = j0 * dx, ue = us + S.cols * dx;
        if (obst.some((O) => overlapU(us, ue, O.u0, O.u1) && y < O.v1 - 1e-6 && y + S.h > O.v0 + 1e-6)) continue;
        let voidA = 0, solid = 0;
        for (let j = 0; j < S.cols; j++) { voidA += y + S.lo[j] - prof[wrap(j0 + j)]; solid += S.hi[j] - S.lo[j]; }
        const score = voidA / Math.max(solid, 1e-6) + 0.3 * Math.max(0, y - ymin - 0.25 * S.h) / S.h - 0.1 * Math.min(1, S.cols * dx / W)
          + (pi >= 0 && stacked(us, ue, y) ? 0.25 : 0);
        if (!best || score < best.score) best = { score, S, j0, y, pi };
      }
    };
    if (W >= (ledge ? 0.06 : 0.08)) {
      for (let t = 0; t < (ledge ? 10 : 16); t++) {
        if (best && t >= 5 && best.score < 0.1) break;       // (a good enough fit: no need to look further)
        const pi = Math.floor(R() * pile.length), stn = pile[pi];
        for (let ai = 0; ai < stn.angs.length; ai++) tryStone(stn.S[ai] || (stn.S[ai] = profileOf(rot(stn.base, stn.angs[ai]), dx)), pi);
      }
    }
    // CHINKING: nothing from the pile sits in this dip, so knock a small stone to fit it (about as wide as the dip, as
    // tall as its shallower side), the way a waller fills the gaps
    const depth = Math.min(prof[wrap(a - 1)], prof[wrap(b + 1)], ceil) - ymin;
    if ((!best || best.score >= 0.35) && W >= 0.03 && depth >= minH * 0.6) {
      for (let t = 0; t < 6; t++) {
        const cw = clamp(W * (0.85 + 0.35 * R()), 0.03, 0.6), ch = clamp(depth * (0.85 + 0.4 * R()), 0.03, ledge ? Math.min(0.12, cw / 3) : 0.22);
        const raw = ledge ? ledgeSlab(R, 0.3, irr) : fieldSlab(R, 0.3, irr), bb = bbox(raw);
        tryStone(profileOf(raw.map(([x, y]) => [(x - bb[0]) / (bb[1] - bb[0]) * cw, (y - bb[2]) / (bb[3] - bb[2]) * ch]), dx), -1);
      }
    }
    if (best && best.score < 0.5) {
      const { S, j0, y } = best;
      stones.push({ p: S.P.map(([x, yy]) => [j0 * dx + x, y + yy]), f: S.P.map(() => J) });
      addEnd(j0 * dx, y + S.hi[0]); addEnd((j0 + S.cols) * dx, y + S.hi[S.cols - 1]);
      if (best.pi >= 0) pile[best.pi] = fromPile(ymin);     // a new stone onto the pile in its place
      for (let j = 0; j < S.cols; j++) { const i = wrap(j0 + j); prof[i] = Math.max(prof[i], y + S.hi[j]); }
    } else {
      // nothing sits well here: leave a gap, and fill the dip up to its lower side
      const lift = Math.min(prof[wrap(a - 1)], prof[wrap(b + 1)], ceil);
      const to = lift > ymin + 1e-6 ? lift : ymin + 0.02;
      for (let j = a; j <= b; j++) prof[wrap(j)] = Math.max(prof[wrap(j)], to);
    }
  }
  // stones poking out of the top (or bottom) of the strip are cut level there; what's left too thin to be a stone (a
  // sliver) is dropped, and the grout-coloured backing shows instead
  const out = [], minT = ledge ? 0.02 : 0.026;
  for (let q of stones) {
    q = clip(q, 0, 1, sec.y1, J); if (q.p.length < 3) continue;
    q = clip(q, 0, -1, -sec.y0, sec.isBottom ? OUT : J); if (q.p.length < 3) continue;
    const b = bbox(q.p); if (b[3] - b[2] < minT || b[1] - b[0] < 2 * minT || Math.abs(area(q.p)) < minT * minT * 2.5) continue;
    out.push(q);
  }
  // inside corners cut the stones that cross them
  for (let k = 0; k < sec.n; k++) if (!sec.convex[k]) {
    for (let i = out.length - 1; i >= 0; i--) {
      const q = out[i], b = bbox(q.p);
      for (const fu of [sec.C[k] - P, sec.C[k], sec.C[k] + P]) if (b[0] < fu - 1e-4 && b[1] > fu + 1e-4) {
        const L = clip(q, 1, 0, fu, J), Rr = clip(q, -1, 0, -fu, J);
        out.splice(i, 1, ...[L, Rr].filter((x) => x.p.length >= 3));
        break;
      }
    }
  }
  return out;
}

// ── the top: coping stones, a jail's roof slabs, a chimney's cap ────────────────────────────────────────────────────────
// Slabs 0.5 to 1.3 m long (at the default stone size), each right across a wall's top, or in rows on a wide top; joints
// slanting a little and staggered row to row. Every slab its own: up to 10% thicker or thinner (its top higher or
// lower: its underside always sits on the wall), its front edge set further in or out at each end (an overhang of 4 to
// 12 cm, not parallel to the wall), ragged, its outer corners chipped, never so far that a chip reaches the wall top.
// Each slab is closed: its outside edges drawn down to the wall top with the underside of the overhang (one flat, dark
// soffit all along the wall), and its sides drawn where it meets the next slab.
function layoutTop(T, o, R) {
  // (an outside edge's lip, by how far it overhangs the wall: its underside reaches back to the wall)
  const lips = new Map(), lipFor = (ov) => { const k = Math.round(Math.max(0, ov) * 1000); if (!lips.has(k)) lips.set(k, { ...skirtDown(T.t, k / 1000 + 0.01), ov: k / 1000 }); return lips.get(k); };
  const out = [], s = o.size, lip = J, holeLip = skirtDown(T.t + 0.06);
  const CJ = { inset: 1, skirt: T.t, dir: 'down', soffit: 0 };                 // a joint between slabs: both sides drawn
  const slab = (x0, x1, z0, z1, fl) => ({ p: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], f: [fl.z0, fl.x1, fl.z1, fl.x0] });
  for (const r of T.rects) {
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0, A0 = alongX ? r.x0 : r.z0, A1 = alongX ? r.x1 : r.z1, C0 = alongX ? r.z0 : r.x0, C1 = alongX ? r.z1 : r.x1;
    const sideA0 = alongX ? 'x0' : 'z0', sideA1 = alongX ? 'x1' : 'z1', sideC0 = alongX ? 'z0' : 'x0', sideC1 = alongX ? 'z1' : 'x1';
    const hole = T.holes && T.holes[0];
    if (hole) {
      // round a flue: four slabs, the edges toward the flue drawn down into it
      const [hx0, hx1, hz0, hz1] = hole, o2 = (k) => (r.open[k] ? lip : J);
      out.push(slab(r.x0, hx0, r.z0, r.z1, { x0: o2('x0'), x1: holeLip, z0: o2('z0'), z1: o2('z1') }));
      out.push(slab(hx1, r.x1, r.z0, r.z1, { x0: holeLip, x1: o2('x1'), z0: o2('z0'), z1: o2('z1') }));
      out.push(slab(hx0, hx1, hz1, r.z1, { x0: J, x1: J, z0: holeLip, z1: o2('z1') }));
      out.push(slab(hx0, hx1, r.z0, hz0, { x0: J, x1: J, z0: o2('z0'), z1: holeLip }));
      continue;
    }
    const across = C1 - C0, rows = across <= 0.95 ? 1 : Math.max(2, Math.round(across / 0.65));
    let prev = [];
    for (let i = 0; i < rows; i++) {
      const c0 = C0 + across * i / rows, c1 = C0 + across * (i + 1) / rows, cuts = [];
      for (let a = A0; ;) {
        let L = s * (1.7 + 2.6 * R());
        if (A1 - (a + L) < s * 1.3) L = A1 - a;
        let e = a + L;
        if (e < A1 - 1e-6 && prev.some((x) => Math.abs(x - e) < 0.12)) e += 0.15;      // (staggered from the row before)
        if (e > A1 - s * 1.3) e = A1;
        cuts.push(e); if (e >= A1 - 1e-6) break; a = e;
      }
      let a = A0, sl0 = 0;
      cuts.forEach((e, k) => {
        const last = k === cuts.length - 1, sl1 = last ? 0 : (R() - 0.5) * 0.25, half = (c1 - c0) / 2;
        // the slab's four corners in (along, across): its joints slant a little
        const pts = [[a - sl0 * half, c0], [e - sl1 * half, c0], [e + sl1 * half, c1], [a + sl0 * half, c1]];
        const fl = [i === 0 && r.open[sideC0] ? lip : J, last && r.open[sideA1] ? lip : J, i === rows - 1 && r.open[sideC1] ? lip : J, k === 0 && r.open[sideA0] ? lip : J];
        let q = { p: alongX ? pts : pts.map(([x, y]) => [y, x]), f: fl };
        if (area(q.p) < 0) q = reverse(q);
        out.push(q); a = e; sl0 = sl1;
      });
      prev = cuts;
    }
  }
  // each edge's kind from where it is: past it the open air (an outside edge: a lip), the flue (drawn down into it), or
  // the next slab (a joint, its sides drawn)
  const rough = T.rough ? 2 : 1;
  const inRect = (x, z) => T.rects.some((r) => x > r.x0 - 1e-6 && x < r.x1 + 1e-6 && z > r.z0 - 1e-6 && z < r.z1 + 1e-6);
  const inHole = (x, z) => (T.holes || []).some(([a, b, c, d]) => x > a && x < b && z > c && z < d);
  return out.map((q) => {
    const n0 = q.p.length, tk = 0.9 + 0.2 * R();
    const F = q.p.map((P, i) => {
      const Q = q.p[(i + 1) % n0], dx = Q[0] - P[0], dz = Q[1] - P[1], L = Math.hypot(dx, dz) || 1, cx = (P[0] + Q[0]) / 2, cz = (P[1] + Q[1]) / 2;
      const mx = cx + dz / L * 0.012, mz = cz - dx / L * 0.012;
      if (inHole(mx, mz)) return holeLip;
      if (inRect(mx, mz)) return CJ;
      // an outside edge: which side of which rect it lies on says how far it overhangs
      const r = T.rects.find((r) => cx > r.x0 - 1e-4 && cx < r.x1 + 1e-4 && cz > r.z0 - 1e-4 && cz < r.z1 + 1e-4) || T.rects[0];
      const side = Math.abs(cx - r.x0) < 1e-4 ? 'x0' : Math.abs(cx - r.x1) < 1e-4 ? 'x1' : Math.abs(cz - r.z0) < 1e-4 ? 'z0' : 'z1';
      return lipFor(T.over < 0 ? 0 : r.ov[side]);
    });
    const isLip = (fl) => fl.ov !== undefined;
    // the outside edges pulled in by their own amount at each end (the overhang left at each corner, for the chips)
    const ovIn = [], ovOut = [];
    const P0 = q.p.map((P, i) => {
      let x = P[0], y = P[1];
      for (const e of [(i - 1 + n0) % n0, i]) {
        if (!isLip(F[e])) { (e === i ? ovOut : ovIn)[i] = Infinity; continue; }
        const A = q.p[e], B = q.p[(e + 1) % n0], eu = B[0] - A[0], ev = B[1] - A[1], L = Math.hypot(eu, ev) || 1, d = Math.max(0, F[e].ov - 0.04) * R() * rough;
        x += -ev / L * d; y += eu / L * d;                          // (inward: an anticlockwise edge's left)
        (e === i ? ovOut : ovIn)[i] = F[e].ov - d;
      }
      return [x, y];
    });
    const p = [], f = [], corner = [];
    P0.forEach((P, i) => {
      p.push(P); f.push(F[i]); corner.push(i);
      if (isLip(F[i])) {
        const Q = P0[(i + 1) % n0], eu = Q[0] - P[0], ev = Q[1] - P[1], L = Math.hypot(eu, ev) || 1, t = 0.3 + 0.4 * R(), k = (0.005 + 0.02 * R()) * rough;
        p.push([P[0] + eu * t + ev / L * k, P[1] + ev * t - eu / L * k]); f.push(F[i]); corner.push(-1);
      }
    });
    const r = { p, f, tk, noDark: true };
    for (let i = r.p.length - 1; i >= 0; i--) {
      const ci = corner[i]; if (ci < 0) continue;
      const n = r.p.length, a = r.f[(i - 1 + n) % n], b = r.f[i];
      if (!(isLip(a) || isLip(b))) continue;
      // a chip never reaches past the wall line: along a joint no deeper than the lip's overhang, across a corner no
      // more than the two overhangs together
      const both = isLip(a) && isLip(b), lim = both ? 0.85 * (ovIn[ci] + ovOut[ci]) : 0.85 * Math.min(ovIn[ci], ovOut[ci]);
      if (!(lim > 0.012) || R() > (both ? 0.85 : 0.35)) continue;
      const c1 = Math.min((0.05 + 0.07 * R()) * rough, lim), c2 = Math.min((0.03 + 0.06 * R()) * rough, lim), len = r.p.length;
      chip(r, i, isLip(a) ? c1 : c2, isLip(b) ? c1 : c2);
      if (r.p.length > len) r.f[i] = lipFor(0);                  // (the chipped face is an outside edge)
    }
    return r;
  });
}

// ── building the triangles ───────────────────────────────────────────────────────────────────────────────────────────
// position, normal, uv (texture, metres / TILE), aTintPaint (rgb: the colour the texture is multiplied by; a: what it is,
// 4 a stone, 3 mortar), aAO (how much sky a corner sees), aRim (x: metres to the stone's outline, y: the stone's size,
// which caps the dark band at its edge), aDrip (the height of the ledge above that the rain runs off)
class Acc {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.tint = []; this.ao = []; this.rim = []; this.drip = []; this.idx = []; this.n = 0; }
  v(p, n, uv, tint, ao, rim, drip) { this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); this.tint.push(tint[0], tint[1], tint[2], tint[3]); this.ao.push(ao); this.rim.push(rim[0], rim[1]); this.drip.push(drip); return this.n++; }
  t(a, b, c) { this.idx.push(a, b, c); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aTintPaint', new THREE.Float32BufferAttribute(this.tint, 4));
    g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.ao, 1));
    g.setAttribute('aRim', new THREE.Float32BufferAttribute(this.rim, 2));
    g.setAttribute('aDrip', new THREE.Float32BufferAttribute(this.drip, 1));
    g.setIndex(this.idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
const ground = (y) => 0.76 + 0.24 * smooth(y, -0.05, 0.7);      // a corner near the ground sees less sky

// one stone: its outline q (on the strip, or on a wall top), how it looks L. Folded round any outside corner it crosses.
function addStone(M, q, surf, L) {
  const c = centroid(q.p), A = Math.abs(area(q.p));
  let pieces = [q], folds = [];
  if (surf.sec) {
    const sec = surf.sec, P = sec.P, sh = Math.floor(c[0] / P) * P;
    q = { p: q.p.map(([u, v]) => [u - sh, v]), f: q.f }; c[0] -= sh; pieces = [q];
    const b = bbox(q.p);
    for (let k = 0; k < sec.n; k++) if (sec.convex[k]) for (const m of [-1, 0, 1, 2]) {
      const fu = sec.C[k] + m * P; if (b[0] < fu - 1e-5 && b[1] > fu + 1e-5) folds.push({ u: fu, k });
    }
    for (const F of folds) pieces = pieces.flatMap((x) => {
      const bb = bbox(x.p); if (!(bb[0] < F.u - 1e-5 && bb[1] > F.u + 1e-5)) return [x];
      return [clip(x, 1, 0, F.u, FOLD), clip(x, -1, 0, -F.u, FOLD)].filter((y) => y.p.length >= 3 && Math.abs(area(y.p)) > 1e-7);
    });
  }
  for (const x of pieces) addPiece(M, x, surf, L, c, A, folds);
}
function addPiece(M, q, surf, L, c, A, folds) {
  const sec = surf.sec, pc = centroid(q.p), pa = Math.abs(area(q.p));
  const k = sec ? faceAt(sec, pc[0]) : 0;
  const at = sec ? (u, v, kk = k) => mapStrip(sec, u, v, kk) : (u, v) => [u, surf.y, v, 0, 1, 0];
  const off = (u, v) => clamp(L.r0 + L.tu * (u - c[0]) + L.tv * (v - c[1]), L.rMin, L.rMax);
  const foldAt = (u) => folds.find((F) => Math.abs(F.u - u) < 1e-5);
  // a small piece of a folded stone bulges less, and no piece more than its own width allows (a thin sliver round a
  // corner would stick out like a fin)
  let pin = Infinity;
  q.p.forEach((P, i) => { const Q = q.p[(i + 1) % q.p.length], dx = Q[0] - P[0], dy = Q[1] - P[1], Ln = Math.hypot(dx, dy) || 1; pin = Math.min(pin, Math.abs((pc[0] - P[0]) * dy - (pc[1] - P[1]) * dx) / Ln); });
  const RG = A > 0.014 ? L.ring : null, share = clamp(Math.sqrt(pa / A) * 1.25, 0.3, 1);
  const hP = Math.min((RG ? L.extra : L.hB) * share, 0.7 * pin);
  // with a ring: the outline on the backing, the face (leaning as the stone leans) on the ring
  const faceH = (u, v) => clamp(L.face + L.tu * (u - c[0]) + L.tv * (v - c[1]), 0.006, 2 * L.face + 0.02);
  // its outline, with a point added half way along each fold (the corner of the stone, rounded out)
  const V = [];
  for (let i = 0; i < q.p.length; i++) {
    const [u, v] = q.p[i], F = foldAt(u);
    V.push({ u, v, f: q.f[i], F });
    if (q.f[i] === FOLD) { const nb = q.p[(i + 1) % q.p.length]; V.push({ u, v: (v + nb[1]) / 2, f: FOLD, F, arris: true }); }
  }
  const n = V.length;
  const uvAt = (u, v) => [u / TILE + L.uvo[0], (sec ? sec.y0 + (v - sec.y0) * sec.fv[k] : v) / TILE + L.uvo[1]];
  // the bulge's high point: off the middle, up to 30% of the way toward one corner
  const av = V[Math.floor(L.apex[1] * n) % n], cp = [pc[0] + (av.u - pc[0]) * L.apex[0], pc[1] + (av.v - pc[1]) * L.apex[0]];
  const cm = at(cp[0], cp[1]), sN = [cm[3], cm[4], cm[5]];
  for (const P of V) {
    if (P.F) {
      // on the fold: the two faces' normals together, so the stone's edge sits out from both faces alike
      const kA = (P.F.k - 1 + sec.n) % sec.n, mA = mapStrip(sec, P.u, P.v, kA), mB = mapStrip(sec, P.u, P.v, P.F.k);
      const nn = [mA[3] + mB[3], mA[4] + mB[4], mA[5] + mB[5]], o = RG ? L.base : off(P.u, P.v);
      // (the seam where a stone folds round a corner: worked out from the STONE's own heights, never the piece's, and
      // along both faces' normals at once, so the two faces of the stone share it exactly and nothing pokes out)
      if (P.arris) P.pos = add(mA, nn, RG ? (L.base + faceH(P.u, P.v)) * 0.92 : o + (Math.min(L.hB, 0.06) - o) * 0.45);
      else P.pos = add(mA, nn, o);
      P.d = P.arris ? Math.max(0.03, L.hB) : 0;
    } else { const m = at(P.u, P.v); P.pos = add(m, [m[3], m[4], m[5]], RG ? L.base : off(P.u, P.v)); P.d = 0; }
    P.uv = uvAt(P.u, P.v);
  }
  // how far the high point is from each edge (what the edge darkening reads); the smallest of them is the stone's size
  const hEdge = V.map((P, i) => {
    const Q = V[(i + 1) % n], dx = Q.u - P.u, dy = Q.v - P.v, Ln = Math.hypot(dx, dy) || 1;
    return Math.max(0.004, Math.abs((cp[0] - P.u) * dy - (cp[1] - P.v) * dx) / Ln);
  });
  const inr = Math.max(0.02, Math.min(...hEdge.filter((h, i) => V[i].f !== FOLD), 1)) * L.edgeK;
  const centre = add(cm, sN, (RG ? L.base + faceH(cp[0], cp[1]) : off(cp[0], cp[1])) + hP), cuv = uvAt(cp[0], cp[1]);
  // local triangles first (for the normals), then into the mesh
  const lv = [], lt = [];
  const lvert = (pos, uv, d, ao, g) => { lv.push({ pos, uv, d, ao, g }); return lv.length - 1; };
  const rimIdx = V.map((P, i) => lvert(P.pos, P.uv, P.d, P.F ? (P.arris ? 0.97 : 0.9) : L.rimAO, 'r' + i));
  let inner = rimIdx;
  if (RG) {
    // each ring corner: in from its outline corner along the line halving the corner's angle, far enough that it is
    // the same distance in from both sides (never more than 45% of the way to the middle)
    const inset = Math.min(RG.k * inr / L.edgeK, RG.max);
    inner = V.map((P, i) => {
      const A0 = V[(i - 1 + n) % n], B0 = V[(i + 1) % n];
      let e1u = P.u - A0.u, e1v = P.v - A0.v, e2u = B0.u - P.u, e2v = B0.v - P.v;
      const l1 = Math.hypot(e1u, e1v) || 1, l2 = Math.hypot(e2u, e2v) || 1; e1u /= l1; e1v /= l1; e2u /= l2; e2v /= l2;
      let bu = -e1v - e2v, bv = e1u + e2u; const bl = Math.hypot(bu, bv) || 1; bu /= bl; bv /= bl;
      const cosT = Math.max(0.35, bu * -e1v + bv * e1u), len = Math.min(inset / cosT, 0.45 * Math.hypot(pc[0] - P.u, pc[1] - P.v));
      const u = P.u + bu * len, v = P.v + bv * len, m = at(u, v), h = faceH(u, v), iuv = uvAt(u, v);
      // (the side from this ring corner down to the outline is longer than it looks from the front: its texture laid
      // out as if the side were unfolded flat, so it isn't stretched into streaks)
      const k2 = Math.sqrt(len * len + h * h) / Math.max(len, 1e-4), r = lv[rimIdx[i]];
      if (!P.F) r.uv = [iuv[0] + (r.uv[0] - iuv[0]) * k2, iuv[1] + (r.uv[1] - iuv[1]) * k2];
      return lvert(add(m, [m[3], m[4], m[5]], L.base + h), iuv, len * cosT, 0.95, 'g' + i);
    });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; lt.push([rimIdx[i], rimIdx[j], inner[j]], [rimIdx[i], inner[j], inner[i]]); }
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, cIdx = lvert(centre, cuv, hEdge[i], 1, 'c');
    lt.push([cIdx, inner[i], inner[j]]);
  }
  if (surf.flip) for (const t of lt) { const x = t[1]; t[1] = t[2]; t[2] = x; }
  // normals: each corner the average of the triangles round it (the centre copies share one), eased toward the face
  const gN = {};
  for (const t of lt) {
    const a = lv[t[0]].pos, b = lv[t[1]].pos, d = lv[t[2]].pos, fn = cross(sub(b, a), sub(d, a));
    for (const i of t) { const g = lv[i].g, s = gN[g] || (gN[g] = [0, 0, 0]); s[0] += fn[0]; s[1] += fn[1]; s[2] += fn[2]; }
  }
  const low = 0.86 + 0.14 * smooth(centre[1], 0, 1.2), tl = [L.tint[0] * low, L.tint[1] * low, L.tint[2] * low, 4];
  // shade under the coping: the top course sits in the coping's shadow
  const cap = (y) => (L.capY === undefined ? 1 : 0.78 + 0.22 * smooth(L.capY - y, 0, 0.22));
  const base = M.n;
  // (the shade the stone adds itself, near the ground and under the coping, never takes a face below 0.7)
  for (const P of lv) M.v(P.pos, norm(add(norm(gN[P.g]), sN, 0.35)), P.uv, tl, Math.max(0.7 * P.ao, P.ao * ground(P.pos[1]) * cap(P.pos[1])), [P.d, inr], L.drip);
  for (const t of lt) M.t(base + t[0], base + t[1], base + t[2]);
  // the sides that show: in an opening, round a sill, down from a coping stone (and under its overhang), into a flue
  for (let i = 0; i < n; i++) {
    const fl = V[i].f, P = V[i], Q = V[(i + 1) % n];
    const el0 = Math.hypot(Q.u - P.u, Q.v - P.v), below = Q.u - P.u > 0.7 * el0;
    if (L.shadow && sec && fl.inset && below) {
      // SHADOW ON THE MORTAR (the sun's own shadow map is far too coarse for a joint): a band just in front of the mortar
      // along the stone's bottom edge, the top third or so of the joint, where the stone above overhangs it. It stops
      // short of a fold by the mortar's depth (there the next face's mortar takes over), so it never pokes past a corner.
      const z = L.core + 0.0012, dv = -0.009, tn = L.shadow, tr = -L.core + 0.004;
      const pu = P.u + (P.F ? tr : 0), qu = Q.u - (Q.F ? tr : 0), vAt = (u) => P.v + (Q.v - P.v) * (u - P.u) / (Q.u - P.u);
      if (qu - pu > 0.01) {
        const pv = vAt(pu), qv = vAt(qu);
        const pts = [[pu, pv], [qu, qv], [qu, qv + dv], [pu, pv + dv]].map(([u, v]) => { const m = at(u, v); return add(m, [m[3], m[4], m[5]], z); });
        const m2 = at((pu + qu) / 2, pv), sc = 3 / TILE;
        quad(L.MS, pts[0], pts[1], pts[2], pts[3], [m2[3], m2[4], m2[5]], tn, [0.6, 0.6, 0.8, 0.8], [[pu * sc, pv * sc], [qu * sc, qv * sc], [qu * sc, (qv + dv) * sc], [pu * sc, (pv + dv) * sc]], L.drip);
      }
    }
    if (!fl.skirt) continue;
    const m = at((P.u + Q.u) / 2, (P.v + Q.v) / 2), fN = [m[3], m[4], m[5]];
    // (a side going down ends at one level whatever the top does: a cap slab's sides all reach the wall top under it)
    const dirA = fl.dir === 'down' ? [0, surf.y - fl.skirt - P.pos[1], 0] : add([0, 0, 0], fN, -(fl.skirt + dot(sub(P.pos, at(P.u, P.v)), fN)));
    const dirB = fl.dir === 'down' ? [0, surf.y - fl.skirt - Q.pos[1], 0] : add([0, 0, 0], fN, -(fl.skirt + dot(sub(Q.pos, at(Q.u, Q.v)), fN)));
    const a2 = add(P.pos, dirA), b2 = add(Q.pos, dirB);
    let sn = norm(cross(sub(Q.pos, P.pos), sub(a2, P.pos)));
    const mid = [(P.pos[0] + Q.pos[0]) / 2, (P.pos[1] + Q.pos[1]) / 2, (P.pos[2] + Q.pos[2]) / 2], flip = dot(sn, sub(mid, centre)) < 0;
    if (flip) sn = [-sn[0], -sn[1], -sn[2]];
    // its texture carries on over the edge, as if folded down
    const eu = Q.u - P.u, ev = Q.v - P.v, el = Math.hypot(eu, ev) || 1, ou = ev / el, ov = -eu / el, k2 = fl.skirt / TILE;
    const farAO = fl.dir === 'down' ? (fl.inset ? 0.8 : 0.66) : 0.8, nearAO = fl.dir === 'down' ? 0.9 : 0.95;
    const i0 = M.v(P.pos, sn, P.uv, tl, nearAO * ground(P.pos[1]), [0, inr], L.drip), i1 = M.v(Q.pos, sn, Q.uv, tl, nearAO * ground(Q.pos[1]), [0, inr], L.drip);
    const i2 = M.v(b2, sn, [Q.uv[0] + ou * k2, Q.uv[1] + ov * k2], tl, farAO * ground(b2[1]), [fl.skirt, inr], L.drip), i3 = M.v(a2, sn, [P.uv[0] + ou * k2, P.uv[1] + ov * k2], tl, farAO * ground(a2[1]), [fl.skirt, inr], L.drip);
    if (flip) { M.t(i0, i2, i1); M.t(i0, i3, i2); } else { M.t(i0, i1, i2); M.t(i0, i2, i3); }
    if (fl.soffit) {
      // the underside of the overhang, back toward the wall: in shadow
      const inA = add(a2, [-ou, 0, -ov], fl.soffit), inB = add(b2, [-ou, 0, -ov], fl.soffit), dk = [tl[0] * 0.9, tl[1] * 0.9, tl[2] * 0.9, 4];
      const j0 = M.v(a2, [0, -1, 0], [P.uv[0] + ou * k2, P.uv[1] + ov * k2], dk, 0.6, [0, inr], L.drip), j1 = M.v(b2, [0, -1, 0], [Q.uv[0] + ou * k2, Q.uv[1] + ov * k2], dk, 0.6, [0, inr], L.drip);
      const j2 = M.v(inB, [0, -1, 0], [Q.uv[0], Q.uv[1]], dk, 0.48, [fl.soffit, inr], L.drip), j3 = M.v(inA, [0, -1, 0], [P.uv[0], P.uv[1]], dk, 0.48, [fl.soffit, inr], L.drip);
      const dn = cross(sub(b2, a2), sub(inA, a2));
      if (dn[1] < 0) { M.t(j0, j1, j2); M.t(j0, j2, j3); } else { M.t(j0, j2, j1); M.t(j0, j3, j2); }
    }
  }
}

// a flat four-cornered piece of the backing, turned to face `toward`
function quad(M, a, b, c, d, toward, tint, ao, uvs, drip) {
  const n = norm(cross(sub(b, a), sub(d, a))), flip = dot(n, toward) < 0, nn = flip ? [-n[0], -n[1], -n[2]] : n;
  const aoF = Array.isArray(ao) ? ao : [ao, ao, ao, ao];
  const i = [a, b, c, d].map((p, j) => M.v(p, nn, uvs[j], tint, aoF[j] * ground(p[1]), [1, 1], drip));
  if (flip) { M.t(i[0], i[2], i[1]); M.t(i[0], i[3], i[2]); } else { M.t(i[0], i[1], i[2]); M.t(i[0], i[2], i[3]); }
}
// the backing behind the stones: mortar (or a dark core, dry walls), set back by the style's recess, with a hole and a
// lined tunnel (or a recess with a dark back) for each opening, and a lid on the topmost block
function addCore(M, sec0, ops, st, tint, dark, capY, flue, dripY = sec0.y1) {
  // (the topmost block's backing goes on up under the coping, so the coping's joints show mortar, not daylight)
  const sec = capY === null ? sec0 : { ...sec0, y1: capY, loop1: sec0.loop1.map((p, i) => { const a = sec0.loop0[i], t = (capY - sec0.y0) / (sec0.y1 - sec0.y0); return [a[0] + (p[0] - a[0]) * t, a[1] + (p[1] - a[1]) * t]; }) };
  const m = st.recess, L0 = offsetLoop(sec.loop0, m), L1 = offsetLoop(sec.loop1, m), n = sec.n, sc = 3 / TILE, drip = dripY;
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n, A = sec.loop0[k], B = sec.loop0[k1], wl = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const U = [(B[0] - A[0]) / wl, 0, (B[1] - A[1]) / wl], N = [U[2], 0, -U[0]].map((x) => -x);   // outward
    const holes = ops.filter((op) => op.face === k);
    if (!sec.prism || !holes.length) {
      const a = [L0[k][0], sec.y0, L0[k][1]], b = [L0[k1][0], sec.y0, L0[k1][1]], c = [L1[k1][0], sec.y1, L1[k1][1]], d = [L1[k][0], sec.y1, L1[k][1]];
      const ua = sec.C[k] * sc, ub = sec.C[k + 1] * sc;
      quad(M, a, b, c, d, mapStrip(sec, (sec.C[k] + sec.C[k + 1]) / 2, (sec.y0 + sec.y1) / 2, k).slice(3), tint, st.coreAO, [[ua, sec.y0 * sc], [ub, sec.y0 * sc], [ub, sec.y1 * sc], [ua, sec.y1 * sc]], drip);
      continue;
    }
    // a face with openings: cut into rectangles round the holes
    const uS = (L0[k][0] - A[0]) * U[0] + (L0[k][1] - A[1]) * U[2], uE = (L0[k1][0] - A[0]) * U[0] + (L0[k1][1] - A[1]) * U[2];
    const e = 0.015, H = holes.map((op) => [op.u - op.w / 2 - e, op.u + op.w / 2 + e, op.v0 <= sec.y0 + 1e-6 ? sec.y0 : op.v0 - e, op.v1 + e]);
    const xs = [...new Set([uS, uE, ...H.flatMap((h) => [h[0], h[1]])])].filter((x) => x >= uS && x <= uE).sort((p, q) => p - q);
    const ys = [...new Set([sec.y0, sec.y1, ...H.flatMap((h) => [h[2], h[3]])])].filter((y) => y >= sec.y0 && y <= sec.y1).sort((p, q) => p - q);
    const P = (u, v) => [A[0] + U[0] * u - N[0] * m, v, A[1] + U[2] * u - N[2] * m];
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
      const cu = (xs[i] + xs[i + 1]) / 2, cv = (ys[j] + ys[j + 1]) / 2;
      if (H.some((h) => cu > h[0] && cu < h[1] && cv > h[2] && cv < h[3])) continue;
      const uvs = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([u, v]) => [(sec.C[k] + u) * sc, v * sc]);
      quad(M, P(xs[i], ys[j]), P(xs[i + 1], ys[j]), P(xs[i + 1], ys[j + 1]), P(xs[i], ys[j + 1]), N, tint, st.coreAO, uvs, drip);
    }
    // the tunnel through the wall (or the recess) for each opening on this face
    for (const op of holes) {
      if (op.mirror) continue;
      const [u0, u1, v0, v1] = H[holes.indexOf(op)], d0 = m, d1 = op.through ? op.t - m : op.reveal;
      const Q = (u, v, dd) => [A[0] + U[0] * u - N[0] * dd, v, A[1] + U[2] * u - N[2] * dd];
      // (the reveal is built of stone: the stones' own sides line it, and what shows between them is mortar)
      const uv = (a, b) => [a * sc, b * sc], ao = [0.78, 0.7, 0.7, 0.78], rt = tint;
      quad(M, Q(u0, v0, d0), Q(u0, v0, d1), Q(u0, v1, d1), Q(u0, v1, d0), U, rt, ao, [uv(0, v0), uv(d1, v0), uv(d1, v1), uv(0, v1)], v1);
      quad(M, Q(u1, v0, d0), Q(u1, v0, d1), Q(u1, v1, d1), Q(u1, v1, d0), U.map((x) => -x), rt, ao, [uv(0, v0), uv(d1, v0), uv(d1, v1), uv(0, v1)], v1);
      quad(M, Q(u0, v1, d0), Q(u1, v1, d0), Q(u1, v1, d1), Q(u0, v1, d1), [0, -1, 0], rt, ao, [uv(u0, 0), uv(u1, 0), uv(u1, d1), uv(u0, d1)], v1);
      if (v0 > sec.y0 + 1e-6) quad(M, Q(u0, v0, d0), Q(u1, v0, d0), Q(u1, v0, d1), Q(u0, v0, d1), [0, 1, 0], rt, ao, [uv(u0, 0), uv(u1, 0), uv(u1, d1), uv(u0, d1)], v1);
      if (!op.through) quad(M, Q(u0, v0, d1), Q(u1, v0, d1), Q(u1, v1, d1), Q(u0, v1, d1), N, dark, 0.15, [uv(u0, v0), uv(u1, v0), uv(u1, v1), uv(u0, v1)], v1);
    }
  }
  if (capY !== null) {
    const pts = L1.map(([x, z]) => new THREE.Vector2(x, z)), tris = THREE.ShapeUtils.triangulateShape(pts, []);
    for (const [a, b, c] of tris) {
      const P = [a, b, c].map((i) => [pts[i].x, capY, pts[i].y]), fn = cross(sub(P[1], P[0]), sub(P[2], P[0]));
      const ord = fn[1] >= 0 ? [0, 1, 2] : [0, 2, 1];
      const ids = ord.map((i) => M.v(P[i], [0, 1, 0], [P[i][0] * sc, P[i][2] * sc], tint, st.coreAO * 0.85, [1, 1], capY));
      M.t(ids[0], ids[1], ids[2]);
    }
    if (flue) { const [x0, x1, z0, z1] = flue, y = capY + 0.004; quad(M, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], dark, 0.08, [[0, 0], [1, 0], [1, 1], [0, 1]], capY); }
  }
}

// ── the whole thing ─────────────────────────────────────────────────────────────────────────────────────────────────────
// recipe: a building's recipe (see RECIPE_DEFAULTS; anything missing takes its default). env.texMean: the stone
// texture's average sRGB colour, so the tints come out as the palette (leave it out for an untextured material).
export function buildStoneWall(recipe = {}, env = {}) {
  const t0 = performance.now();
  const o = stoneRecipe(recipe);
  const st = STYLES[o.style], shape = SHAPES[o.shape], spec = shape.make(o);
  const pal = PALETTES[o.palette] || PALETTES[shape.palette || (o.style === 'ledgestone' ? 'brown' : 'grey')], mo = MORTARS[o.mortar];
  // (a shape may want its own stones: the jail's smaller, rounder cobbles)
  const oL = { ...o, size: o.size * (shape.stones?.size ?? 1), round: !!shape.stones?.round };
  const R = rng((o.seed >>> 0) * 7919 + 17), M = { stone: new Acc(), mortar: new Acc() };
  const mean = env.texMean ? env.texMean.map(lin) : [1, 1, 1];
  const tintOf = (c, l = 1) => c.map((x, i) => lin(clamp(x * l, 0, 1)) / mean[i]);
  const jw = o.joint * st.joint, ns = (o.seed >>> 0) * 31 + 7;
  let count = 0;
  // a stone's colour: one of the palette's, drifted slowly across the wall, lighter or darker by one number
  const colourAt = (pos, noDark) => {
    const r = R(), wS = 0.1 + 0.2 * o.colourMix, sw = r < 0.13 && !noDark ? pal.dark : r < 0.25 ? pal.rust : r < 0.25 + wS ? pal.second : pal.base;
    const n1 = noise3(pos[0] / 2.6, pos[1] / 2.6, pos[2] / 2.6, ns), n2 = noise3(pos[0] / 2.6 + 17, pos[1] / 2.6, pos[2] / 2.6 + 5, ns);
    const c = sw === pal.base ? sw.map((x, i) => x + (pal.second[i] - x) * 0.55 * n1) : sw;
    return tintOf(c, (1 + (R() * 2 - 1) * st.value) * (1 + 0.08 * (2 * n2 - 1)));
  };
  // the mortar: the palette's base colour, partly greyed, at the mortar family's lightness (the dry styles: the same
  // colour a little darker, for their backing)
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], g0 = lum(pal.base);
  const mortarCol = mo.abs ? mo.abs.map((x) => x * st.fill) : pal.base.map((x, i) => (x + (g0 - x) * mo.grey) * mo.light * st.fill * (i === 0 ? mo.warm : i === 2 ? 2 - mo.warm : 1));
  const mortarTint = [...tintOf(mortarCol), 3], shadowTint = [...tintOf(mortarCol, 0.7), 3], halfTint = mortarTint;
  const dark = [...tintOf([0.06, 0.055, 0.05]), 3];
  // how one stone looks: how far its rim stands out, its lean, its bulge and where that peaks, where it reads the texture
  const look = (q, pos, extra = {}) => {
    const A = Math.abs(area(q.p)), ang = R() * 6.283, tilt = st.tilt * (0.5 + 0.5 * R()), proud = q.proud || 0, rg = st.ring;
    const bb = bbox(q.p), short = Math.min(bb[1] - bb[0], bb[3] - bb[2]);
    const hB = rg ? Math.min(o.bulge * st.bulgeK * Math.sqrt(A) * (0.75 + 0.5 * R()), 0.035 + 0.02 * o.bulge)
      : (st.bulge[0] + (st.bulge[1] - st.bulge[0]) * R()) * short * o.bulge / 0.6 * (R() < 0.12 ? 0.45 : 1) + st.stick * R();
    const tint = colourAt(pos, q.noDark), lt = Math.pow(q.light || 1, 2.2), r0 = -st.recess + st.rim[0] + (st.rim[1] - st.rim[0]) * R() + proud;
    // (a stone's face is a fan round one point: past about 2 cm proud of the wall line, seen edge on at a corner or a
    // wall end, that point reads as a spike, not a rounded stone)
    const hBc = rg ? hB : Math.min(hB, 0.022 + proud - r0);
    return { tint: tint.map((x) => x * lt), r0, hB: hBc, rMin: -st.recess + 0.002 + proud, rMax: -st.recess + st.rim[1] + 0.006 + proud,
      tu: Math.cos(ang) * tilt, tv: Math.sin(ang) * tilt, apex: [0.3 * R(), R()], edgeK: 0.35 + 0.65 * R(), rimAO: st.rimAO, uvo: [R(), R()],
      ring: rg, base: -st.recess + 0.0015, face: rg ? hB * rg.faceK + rg.faceAdd[0] + (rg.faceAdd[1] - rg.faceAdd[0]) * R() : 0, extra: rg ? hB * (1 - rg.faceK) : 0,
      core: -st.recess, shadow: st.shadow ? shadowTint : null, shadowHalf: halfTint, MS: M.mortar, drip: q.drip, ...extra };
  };
  // the joint: a dry wall's gaps vary stone to stone (0.5 to 2.5 cm on ledgestone)
  const jwOf = () => (st.jointVar ? jw * (0.6 + 2.6 * R() * R()) : jw);
  // the blocks of wall, bottom to top
  const secs = spec.sections.map((S, i) => makeSection(S, i === 0, i === spec.sections.length - 1));
  const openings = [];
  for (const op of spec.openings || []) {
    const reveal = op.through ? op.t / 2 : op.depth;
    const front = { ...op, sec: op.sec || 0, reveal };
    openings.push(front);
    if (op.through) {
      const sec = secs[front.sec], wb = sec.C[op.back + 1] - sec.C[op.back];
      openings.push({ ...front, face: op.back, u: wb - op.u, mirror: true });
    }
  }
  const T = spec.top, capBottom = T.y - T.t;
  secs.forEach((sec, si) => {
    const ops = openings.filter((op) => op.sec === si);
    const polys = o.style === 'mortared' ? layoutCoursed(sec, ops, oL, R) : layoutPacked(sec, ops, oL, R, o.style === 'ledgestone');
    for (const q of polys) {
      const f = finish(q, jwOf(), st.ring && Math.abs(area(q.p)) < 0.012 ? 4 : st.maxN, 0.03); if (!f) continue;
      const c = centroid(f.p), m = mapStrip(sec, c[0], c[1], faceAt(sec, c[0]));
      f.proud = q.proud; f.drip = spec.building ? -1 : q.drip ?? (sec.isTop ? capBottom : sec.y1);
      addStone(M.stone, f, { sec }, look(f, m, sec.isTop ? { capY: capBottom } : {})); count++;
    }
    addCore(M.mortar, sec, ops, st, mortarTint, dark, sec.isTop ? T.y - Math.min(0.03, T.t * 0.3) : null, sec.isTop && T.holes ? T.holes[0] : null, spec.building ? -1 : sec.y1);
  });
  // the top: coping stones (a jail's roof, a chimney's cap) with their edges drawn down over the wall
  for (const q of layoutTop(T, o, R)) {
    if (T.hide) { const b = bbox(q.p); if (b[0] > T.hide[0] && b[1] < T.hide[1] && b[2] > T.hide[2] && b[3] < T.hide[3]) continue; }
    // (all its corners kept: merging corners away would pull a slab's joint edge to a point and open a gap)
    const f = finish(q, jw * 0.5, 64, 0.004); if (!f) continue;
    const c = centroid(f.p); f.drip = T.y - T.t - 0.08; f.noDark = true;  // (no rain streak down its own lip)
    const L = look(f, [c[0], T.y, c[1]]);
    // (its top: up to 10% higher or lower than the next slab's, rounded off toward its edges; a dry chimney's capstones
    // rougher)
    const r0 = T.t * (q.tk - 1);
    Object.assign(L, T.rough ? { r0: r0 - 0.01 * R(), rMin: r0 - 0.03, rMax: r0 + 0.03, hB: 0.025 + 0.03 * R() } : { r0, rMin: r0 - 0.012, rMax: r0 + 0.012, tu: L.tu * 0.5, tv: L.tv * 0.5, hB: 0.008 + 0.012 * R() }, { ring: null, shadow: null });
    addStone(M.stone, f, { y: T.y, flip: true }, L); count++;
  }
  // STEPS: a stone stoop in front of a door: one or two slabs, their front and ends drawn down into the ground
  for (const S0 of spec.steps || []) {
    const sec = secs[0], A = sec.loop0[S0.face], B = sec.loop0[(S0.face + 1) % sec.n], wl = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const U = [(B[0] - A[0]) / wl, (B[1] - A[1]) / wl], N = [U[1], -U[0]].map((x) => -x), lipS = skirtDown(S0.h + 0.12, 0);
    const n2 = S0.w > 1.1 ? 2 : 1, cut = S0.u - S0.w / 2 + S0.w * (n2 === 2 ? 0.42 + 0.16 * R() : 1);
    const parts = n2 === 2 ? [[S0.u - S0.w / 2, cut], [cut, S0.u + S0.w / 2]] : [[S0.u - S0.w / 2, S0.u + S0.w / 2]];
    parts.forEach(([a, b], i) => {
      const P = (u, d) => [A[0] + U[0] * u + N[0] * d, A[1] + U[1] * u + N[1] * d], dd = S0.depth * (0.92 + 0.12 * R());
      let q = { p: [P(a, -0.02), P(b, -0.02), P(b, dd), P(a, dd)], f: [OUT, i === parts.length - 1 ? lipS : J, lipS, i === 0 ? lipS : J] };
      if (area(q.p) < 0) q = reverse(q);
      for (let k = q.p.length - 1; k >= 0; k--) { const n = q.p.length; if (q.f[k] === lipS && q.f[(k - 1 + n) % n] === lipS && R() < 0.8) chip(q, k, 0.03 + 0.04 * R(), 0.02 + 0.04 * R()); }
      const f = finish(q, jw * 0.5, 8, 0.03); if (!f) return;
      const c = centroid(f.p); f.drip = -1;
      const L = look(f, [c[0], S0.h, c[1]]);
      Object.assign(L, { r0: -0.01, rMin: -0.018, rMax: 0.002, tu: L.tu * 0.3, tv: L.tv * 0.3, hB: 0.01 + 0.01 * R(), ring: null, shadow: null });
      addStone(M.stone, f, { y: S0.h, flip: true }, L); count++;
    });
  }
  // where each opening is, in the world, for fitting a door, bars, a frame
  const outOpen = openings.filter((op) => !op.mirror).map((op) => {
    const sec = secs[op.sec], m = mapStrip(sec, sec.C[op.face] + op.u, (Math.max(op.v0, 0) + op.v1) / 2, op.face);
    const A = sec.loop0[op.face], B = sec.loop0[(op.face + 1) % sec.n], wl = Math.hypot(B[0] - A[0], B[1] - A[1]);
    return { kind: op.kind, through: !!op.through, centre: [m[0], m[1], m[2]], U: [(B[0] - A[0]) / wl, 0, (B[1] - A[1]) / wl], N: [m[3], m[4], m[5]], w: op.w, h: op.v1 - Math.max(op.v0, 0), bottom: Math.max(op.v0, 0), depth: op.through ? op.t : op.depth };
  });
  const stone = M.stone.geometry(), mortar = M.mortar.geometry();
  const box = stone.boundingBox.clone().union(mortar.boundingBox);
  return { stone, mortar, stones: count, tris: { stone: M.stone.idx.length / 3, mortar: M.mortar.idx.length / 3 }, ms: performance.now() - t0,
    openings: outOpen, top: T.y, box, building: spec.building || null, pipe: spec.pipe ? { ...spec.pipe, y: T.y } : null, palette: pal, options: o };
}

// ── the shader: darker stone edges from aRim, rain streaks from aDrip ───────────────────────────────────────────────────
// Patches a MeshStandardMaterial (after any other patch, such as the Material Lab's weathering, which it hooks into when
// it finds it: its edge band, and the drip edge its streaks start from). Without that, it darkens the edges itself:
// uniforms uStoneEdge (how dark) and uStoneEdgeW (band, metres).
const HOOK = 'diffuseColor.rgb *= 1.0 - uEdgeDark * wRim;', DRIP = 'float wTop = uFixedTop;';
export function stoneEdges(mat, own = { uStoneEdge: { value: 0.5 }, uStoneEdgeW: { value: 0.04 } }) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRim;\nattribute float aDrip;\nvarying vec2 vRim;\nvarying float vDrip;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRim = aRim;\nvDrip = aDrip;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRim;\nvarying float vDrip;').replace(DRIP, 'float wTop = vDrip;');
    if (sh.fragmentShader.includes(HOOK)) {
      // the weathering shader's own bevel: a band that darkens toward the outline, curving in, and tilts the light there
      sh.fragmentShader = sh.fragmentShader.replace(HOOK, `{
        float sW = max(min(uEdgeDarkW, 0.6 * vRim.y), 0.0005) * (0.8 + 0.4 * wFine.b);
        float sQ = 1.0 - clamp(vRim.x / sW, 0.0, 1.0);
        wRim = sQ * sQ;
        wRimH = -0.5 * uBevel * sW * wRim;
      }
      ` + HOOK);
    } else {
      Object.assign(sh.uniforms, own);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uStoneEdge, uStoneEdgeW;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        { float sW = max(min(uStoneEdgeW, 0.6 * vRim.y), 0.0005); float sQ = 1.0 - clamp(vRim.x / sW, 0.0, 1.0); diffuseColor.rgb *= 1.0 - uStoneEdge * sQ * sQ; }`);
    }
  };
  mat.customProgramCacheKey = () => prevKey() + '+stoneEdges';
  return mat;
}
