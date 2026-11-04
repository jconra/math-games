// THE VALLEY'S ENDS (Mathwood Valley): the way round, from one end of the valley to the other, made so it can't be seen.
//
// The land's last 150 m at each end is ONE BAND OF WOODS, the same at both ends: the west end's (x -800 to -650) is the
// land as made; the east end's (x 650 to 800) is a copy of it (heights, water, footpaths, the land's maps, trees, plants,
// rocks, the ground's own patterns), moved by MOVE: P m along x, Q m along z (the valley runs at a slant, so its floor is
// further south at the east end) and DY m up (the east end's floor is higher). The WRAP lines run down the middle of the
// band, 75 m in from each edge: a rider crossing one is moved by exactly MOVE (or back), so everything round them is the
// same before and after. The river and the road run on through the band (the river comes in at the east end's edge and
// runs into the creek that feeds the lake; the road goes out one end and comes in at the other).
//
// Round the band: the mountains beside each end slope down toward the band (SHAPE: their height over the end's floor
// eased down to low hills), so no peak stands up at the land's edge; the band is open to riders only across the valley's
// floor and its lower slopes (WALK), the rest of it out of bounds; and a low ground fog (FOG) lies in the woods there,
// thickest on the ground and gone a few metres up, coming in over the last ~120 m before the band.
//
// What was asked for (2026-11-03): the same woods at both ends with the way round inside them, before any edge; the fog
// low, a few metres, seen only among the trees; the mountains declining toward the edges, not matched.
//
//   ENDS              the numbers below
//   alias(x, z)       for a spot in the east band's copy: [x, z] of the west band's spot it shows; else null
//   canon(x, z)       alias(x, z) or [x, z] (the spot whose look a spot has)
//   inBand(x)         |x| in the band (the land's last BAND m at either end)
//   walkable(x, z)    false where a walker is out of bounds at the ends (the band beyond its floor)
//   wrapOf(x, z)      null, or { dx, dy, dz } for a spot past a wrap line: where it comes out is (x + dx, z + dz), dy up
//   fogShare(x)       how much of the ground fog lies there, 0..1 (by x alone)
//   fogSeen(x)        how much of it shows to an eye there, 0..1 (only in among the trees at the ends)
//   fogHides(c, p, hc, hp)   how much of a thing at p the fog hides seen from c (the shader's sum, for the game)
//   ENDS_FOG_GLSL     the fog, for a shader (uniforms fogEnd0, fogEnd1)
//   floorCells(N, TEX, SIZE)   the grid's numbers for copying cells: { band, di, dj }
export const ENDS = {
  SIZE: 1600,
  band: 150,          // m: each end's band (the land's last 150 m)
  P: 1450,            // m along x from the west band to the east's (464 of the land's 3.125 m cells, 1856 of its 0.78 m pixels)
  Q: 556.25,          // m along z (178 cells, 712 pixels): the river at the west edge lands on the east creek's head
  DY: 70,             // m up: the floors meet (the copied river runs down into that creek)
  wrap: 725,          // |x| of the two wrap lines (the band's middle)
  blend: 90,          // m inward of the east band over which the east's own land eases into the copy
  blendZ: 45,         // m north of the copy (the east band's north part, which the west band has no land for) likewise
  // the band's floor and lower slopes, open to riders (z in the west's own reckoning; the east's is z + Q). Past them,
  // within `wall` m of the band (and in it), a rider is out of bounds (the woods too thick): the land's edges stay 80 m
  // or more away, behind trees and the fog
  walk: [-720, 150], wall: 640,
  // and where the mountains are eased down toward the ends (|x| past shape.from), the land's north and south edges are
  // kept `edgeZ` m off: the corners came down low enough to walk to the edge and look over it
  edgeZ: 740,
  // the mountains slope down toward the band: their height over each end's floor (west -31, east -31 + DY) is eased
  // toward a low hill (cap m high at most) from |x| = from to |x| = to, and stays so across the band
  shape: { floor: -31, cap: 40, from: 330, to: 650 },
  // the ground fog: in from |x| = from to full by |x| = to; `thick` per metre on the ground (at full), thinning by e every
  // `deep` m up (so a few metres deep, gone by ~10 m). It shows only once the eye is in among the trees there: none with
  // the eye nearer the middle than |x| = seen[0], all of it past seen[1] (from the open valley and the town it isn't
  // seen at all)
  fog: { from: 530, to: 650, thick: 0.06, deep: 2.4, seen: [580, 660] },
};
ENDS.east0 = ENDS.SIZE / 2 - ENDS.band;           // 650: the east band's inner edge
ENDS.copyZ0 = -ENDS.SIZE / 2 + ENDS.Q;            // -243.75: the east band's copy runs from here south (the west band's north edge)

export function alias(x, z) {
  if (x < ENDS.east0 || z < ENDS.copyZ0) return null;
  return [x - ENDS.P, z - ENDS.Q];
}
export function canon(x, z) { return alias(x, z) || [x, z]; }
export const inBand = (x) => Math.abs(x) >= ENDS.east0;
// out of bounds: within `wall` of either end, beyond the band's floor (the east's measured in the west's reckoning)
export function walkable(x, z) {
  if (Math.abs(x) > ENDS.shape.from && Math.abs(z) > ENDS.edgeZ) return false;
  if (Math.abs(x) < ENDS.wall) return true;
  const zw = x > 0 ? z - ENDS.Q : z;
  return zw >= ENDS.walk[0] && zw <= ENDS.walk[1];
}
// past a wrap line: the way round (east: back by MOVE, to the west band; west: on by MOVE, to the east's)
export function wrapOf(x) {
  if (x >= ENDS.wrap) return { dx: -ENDS.P, dy: -ENDS.DY, dz: -ENDS.Q };
  if (x <= -ENDS.wrap) return { dx: ENDS.P, dy: ENDS.DY, dz: ENDS.Q };
  return null;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const fogShare = (x) => smooth(ENDS.fog.from, ENDS.fog.to, Math.abs(x));
// how much of the fog shows to an eye at x (0 out in the valley .. 1 in among the trees at the ends)
export const fogSeen = (x) => smooth(ENDS.fog.seen[0], ENDS.fog.seen[1], Math.abs(x));
// the mountains eased down toward the band: h over the end's floor `v` (> 0) -> the new height over it, at |x|
export function shapeEnd(h, x) {
  const base = ENDS.shape.floor + (x > 0 ? ENDS.DY : 0), v = h - base; if (v <= 0) return h;
  const s = smooth(ENDS.shape.from, ENDS.shape.to, Math.abs(x)); if (s <= 0) return h;
  const c = ENDS.shape.cap, low = c * (1 - Math.exp(-v / c));   // (a low hill: the foot kept, the top levelled off)
  return base + v + (low - v) * s;
}
// the land's grid (N cells over SIZE m, TEX m a cell): the band's width in cells and the move in cells
export function floorCells(N, TEX) {
  return { band: Math.round(ENDS.band / TEX), di: Math.round(ENDS.P / TEX), dj: Math.round(ENDS.Q / TEX), n: N };
}

// how much of a thing the ground fog hides, 0 (none) .. 1, seen from c ({ x, y, z }, hc m over the ground under it) at p
// (hp m over the ground under it): the shader's own sum (ENDS_FOG_GLSL), for the game (what can be seen, src/sight.js)
export function fogHides(c, p, hc, hp) {
  const F = ENDS.fog, x0 = F.from, dx = p.x - c.x, dz = p.z - c.z, L = Math.hypot(dx, p.y - c.y, dz), seen = fogSeen(c.x);
  if (seen <= 0 || (Math.max(c.x, p.x) < x0 && Math.min(c.x, p.x) > -x0)) return 0;
  const half = (l, ha, hb, ra, rb) => { const a = Math.exp(-Math.max(ha, 0) / F.deep), b = Math.exp(-Math.max(hb, 0) / F.deep), dh = (Math.max(hb, 0) - Math.max(ha, 0)) / F.deep;
    return 0.5 * (ra + rb) * l * (Math.abs(dh) > 0.01 ? (a - b) / dh : 0.5 * (a + b)); };
  const span = (t0, t1) => { if (t1 <= t0) return 0; const l = L * (t1 - t0) * 0.5, tm = (t0 + t1) / 2, x = (t) => c.x + dx * t, h = (t) => hc + (hp - hc) * t;
    return half(l, h(t0), h(tm), fogShare(x(t0)), fogShare(x(tm))) + half(l, h(tm), h(t1), fogShare(x(tm)), fogShare(x(t1))); };
  const ta = 0, tb = 1;   // (on past the land's edge, as the shader's)
  let sum = 0;
  if (Math.abs(dx) > 1e-4) { const te = (x0 - c.x) / dx, tw = (-x0 - c.x) / dx;
    sum += dx > 0 ? span(Math.max(ta, te), tb) + span(ta, Math.min(tb, tw)) : span(ta, Math.min(tb, te)) + span(Math.max(ta, tw), tb);
  } else if (Math.abs(c.x) >= x0) sum += span(ta, tb);
  return 1 - Math.exp(-sum * F.thick * seen);
}

// THE GROUND FOG, for a shader. How much of a pixel the fog hides is its thickness added up along the way from the eye
// (c, hc m above the ground under it) to the pixel (p, hp m above the ground under it), over the part of the way in
// either end (|x| past fogEnd0.x, and on past the land's edge): the thickness there thins by e every fogEnd0.z m up
// (taken to change evenly along the way: the integral is exact for that, in two halves so the coming in by x is
// followed), times fogEnd0.w a metre at full, times how far in by x (from fogEnd0.x to full by fogEnd0.y). fogEnd1.x: on
// (0 off); fogEnd1.y: the ground's height under the eye; fogEnd1.z: (unused); fogEnd1.w: how much of it shows to the eye
// where it is (fogSeen).
export const ENDS_FOG_GLSL = `
  float fogEndHalf(float L, float ha, float hb, float ra, float rb) {   // (one half: L m from ha to hb m up, thickness ra to rb)
    float k = 1.0 / fogEnd0.z, a = exp(-max(ha, 0.0) * k), b = exp(-max(hb, 0.0) * k), dh = (max(hb, 0.0) - max(ha, 0.0)) * k;
    return 0.5 * (ra + rb) * L * (abs(dh) > 0.01 ? (a - b) / dh : 0.5 * (a + b)); }
  float fogEndSpan(vec3 c, vec3 p, float hc, float hp, float t0, float t1) {   // (the way from t0 to t1 of c..p)
    if (t1 <= t0) return 0.0;
    float L = length(p - c) * (t1 - t0) * 0.5, tm = 0.5 * (t0 + t1);
    float x0 = mix(c.x, p.x, t0), xm = mix(c.x, p.x, tm), x1 = mix(c.x, p.x, t1);
    float r0 = smoothstep(fogEnd0.x, fogEnd0.y, abs(x0)), rm = smoothstep(fogEnd0.x, fogEnd0.y, abs(xm)), r1 = smoothstep(fogEnd0.x, fogEnd0.y, abs(x1));
    float h0 = mix(hc, hp, t0), hm = mix(hc, hp, tm), h1 = mix(hc, hp, t1);
    return fogEndHalf(L, h0, hm, r0, rm) + fogEndHalf(L, hm, h1, rm, r1); }
  float fogEndDepth(vec3 c, vec3 p, float hc, float hp) {
    if (fogEnd1.x <= 0.0 || fogEnd1.w <= 0.0) return 0.0;
    float x0 = fogEnd0.x, dx = p.x - c.x;
    if (max(c.x, p.x) < x0 && min(c.x, p.x) > -x0) return 0.0;
    // the way split into the part past +x0 and the part past -x0. (It runs on past the land's edge, as if the woods went
    // on: the sky low past the edge then reads as the fog the woods there would be, where it showed brighter than the
    // fogged woods the way round looks out on)
    float ta = 0.0, tb = 1.0, sum = 0.0;
    if (abs(dx) > 1e-4) {
      float te = (x0 - c.x) / dx, tw = (-x0 - c.x) / dx;   // (where the way crosses +x0 and -x0)
      // past +x0: t > te going east (dx > 0), t < te going west
      float e0 = dx > 0.0 ? max(ta, te) : ta, e1 = dx > 0.0 ? tb : min(tb, te);
      float w0 = dx > 0.0 ? ta : max(ta, tw), w1 = dx > 0.0 ? min(tb, tw) : tb;
      sum += fogEndSpan(c, p, hc, hp, e0, e1) + fogEndSpan(c, p, hc, hp, w0, w1);
    } else if (abs(c.x) >= x0) sum += fogEndSpan(c, p, hc, hp, ta, tb);
    return sum * fogEnd0.w * fogEnd1.w; }
`;
