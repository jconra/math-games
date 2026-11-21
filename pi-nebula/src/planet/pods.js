// THE STASIS PODS ON THE GROUND for a rescue (plain numbers, no THREE: the tests run it in node; src/planet/podsdraw.js
// draws them; the pod itself, the game's maker's own model: kit/stasispod.js). His answers for the medical runs (MED-1,
// MED-2): you walk down the Medic's ramp to 3 to 6 pods on the ground, beside a crashed ship (src/planet/wreck.js), the
// pilot setting down beside them in the landing ring; nobody is hurt, they are asleep in the pods, safe until opened.
//
// How many, by the planet's seed (3 to 6); where: on the ground between the landing ring and the wreck or round it, each
// lying along the wreck (as the ring runs), its screen and keypad toward the ring (where the Medic sets down and whoever
// opens them comes from), and turned a little, near the wreck but clear of it, near each other but with
// room to walk between, never on the landing place, on even ground. Each sits on the ground: leant with the ground under
// it and sunk a little into it (its feet), none of it above the ground under it. The same seed and the same wreck, the
// same pods in the same places.
//
//   podCount(seed)                          3 to 6
//   podsPlan(land, seed, { site, tris })    site: the wreck's site (wreck.js wreckSite / settle: x, z, a (its way round
//                                           the ring), dist); tris: the wreck's triangles in the world (x, y, z corners,
//                                           one after another), its pieces as they lie. -> { pods: [{ x, z, yaw, y, mat
//                                           (16 numbers: the pod's frame, its foot's middle at its origin, long along
//                                           its x, its front +z), foot ([x, y, z] its footprint's points in the world,
//                                           each under the ground), under (each foot point's depth under the ground,
//                                           m), wreck (m to the wreck), tilt, look (who sleeps in it: an index into
//                                           the sleepers) }], count, tried }
//   footprintTris(plan)                     the pods' footprints as triangles in the world, for wreck.js clearUnder
//   sleeperOrder(seed, n)                   the sleepers in the seed's order (no two pods the same person)
//   PODS                                    the numbers
import { rng, subSeed } from './noise.js';
import { wrapD } from './land.js';
import { POD } from '../../kit/stasispod-plan.js';

export const PODS = {
  count: [3, 6],
  // its footprint (metres): his pod's length and width at its size
  foot: { long: POD.long, wide: POD.long * POD.his.wide / POD.his.long },
  ring: 2,          // metres past the landing place's level ground, at least (the wreck keeps the same: wreck.js settle)
  wreck: [1.5, 3],  // metres from the wreck: at least the first; best about the second
  apart: [1.5, 3],  // metres between two pods' footprints: at least the first (to walk between), best about the second
  turn: 0.35,       // the most each is turned from lying along the ring (radians, either way)
  tilt: 0.12,       // the most a pod leans with the ground under it (radians)
  sink: [0.04, 0.2],// metres: its highest foot point this far under the ground; its deepest no deeper than the second
  spread: 0.6,      // metres: the ground under it no more uneven than this
  step: 0.75,       // metres between the places tried
};
export const podCount = (seed) => PODS.count[0] + Math.floor(rng(subSeed(seed, 'pod count'))() * (PODS.count[1] - PODS.count[0] + 1));

// ── little sums ──────────────────────────────────────────────────────────────────────────────────────────────────
const hyp = Math.hypot;
// its footprint's points (the pod's own frame: x along, z across), round its edge every ~0.4 m, and its middle
function footLocal() {
  const { long, wide } = PODS.foot, hx = long / 2, hz = wide / 2, out = [[0, 0]];
  const nx = Math.ceil(long / 0.4), nz = Math.ceil(wide / 0.4);
  for (let i = 0; i <= nx; i++) { const x = -hx + (long * i) / nx; out.push([x, -hz], [x, hz]); }
  for (let j = 1; j < nz; j++) { const z = -hz + (wide * j) / nz; out.push([-hx, z], [hx, z]); }
  return out;
}
const FOOT = footLocal();
// a point of the pod's frame (x along, z across) at (cx, cz) turned by yaw (its x along (cos yaw, -sin yaw))
const toWorld = (cx, cz, yaw, x, z) => [cx + x * Math.cos(yaw) + z * Math.sin(yaw), cz - x * Math.sin(yaw) + z * Math.cos(yaw)];
// whether a point (world) is inside a pod's footprint (grown by m)
function inside(P, x, z, m = 0) {
  const dx = x - P.x, dz = z - P.z, c = Math.cos(P.yaw), s = Math.sin(P.yaw), u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.abs(u) <= PODS.foot.long / 2 + m && Math.abs(v) <= PODS.foot.wide / 2 + m;
}
// the gap between two footprints (0 if they touch or cross; two far apart: about their middles' distance less a length)
function gapBetween(A, B) {
  const dc = hyp(A.x - B.x, A.z - B.z); if (dc > PODS.foot.long + 6) return dc - PODS.foot.long;
  let g = Infinity;
  for (const [ax, az] of A.ring) { if (inside(B, ax, az)) return 0; for (const [bx, bz] of B.ring) g = Math.min(g, hyp(ax - bx, az - bz)); }
  for (const [bx, bz] of B.ring) if (inside(A, bx, bz)) return 0;
  return g;
}
// the ground's plane under some points (least squares): its normal
function plane(land, pts) {
  let sx = 0, sz = 0, sh = 0, sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0; const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, mz = pts.reduce((s, p) => s + p[1], 0) / n;
  for (const [x0, z0] of pts) { const x = x0 - mx, z = z0 - mz, h = land.heightAt(x0, z0); sx += x; sz += z; sh += h; sxx += x * x; szz += z * z; sxz += x * z; sxh += x * h; szh += z * h; }
  const det = sxx * szz - sxz * sxz; if (Math.abs(det) < 1e-9) return [0, 1, 0];
  const hm = sh / n, a = ((sxh - sx * hm) * szz - (szh - sz * hm) * sxz) / det, b = ((szh - sz * hm) * sxx - (sxh - sx * hm) * sxz) / det, l = hyp(a, 1, b);
  return [-a / l, 1 / l, -b / l];
}
// HOW FAR FROM THE WRECK, anywhere near it: its triangles (x, y, z corners, one after another) laid on a grid of
// NEAR.cell metres round the site (each triangle marks the cells its box covers, as wreck.js clearUnder does), then the
// distance from every cell to the nearest marked one (two sweeps, each cell from its neighbours: within a few percent of
// the straight distance). Past the grid: far.
const NEAR = { cell: 0.5, half: 60 };
function nearWreck(tris, cx, cz) {
  const C = NEAR.cell, n = Math.ceil((2 * NEAR.half) / C), x0 = cx - NEAR.half, z0 = cz - NEAR.half, D = new Float32Array(n * n).fill(1e9);
  const ci = (x) => Math.floor((x - x0) / C), cj = (z) => Math.floor((z - z0) / C);
  for (let t = 0; t < tris.length; t += 9) {
    const i0 = Math.max(0, ci(Math.min(tris[t], tris[t + 3], tris[t + 6]))), i1 = Math.min(n - 1, ci(Math.max(tris[t], tris[t + 3], tris[t + 6])));
    const j0 = Math.max(0, cj(Math.min(tris[t + 2], tris[t + 5], tris[t + 8]))), j1 = Math.min(n - 1, cj(Math.max(tris[t + 2], tris[t + 5], tris[t + 8])));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) D[j * n + i] = 0;
  }
  const d1 = C, d2 = C * Math.SQRT2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = D[j * n + i]; if (!v) continue;
    if (i > 0) v = Math.min(v, D[j * n + i - 1] + d1);
    if (j > 0) { v = Math.min(v, D[(j - 1) * n + i] + d1); if (i > 0) v = Math.min(v, D[(j - 1) * n + i - 1] + d2); if (i < n - 1) v = Math.min(v, D[(j - 1) * n + i + 1] + d2); }
    D[j * n + i] = v;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    let v = D[j * n + i]; if (!v) continue;
    if (i < n - 1) v = Math.min(v, D[j * n + i + 1] + d1);
    if (j < n - 1) { v = Math.min(v, D[(j + 1) * n + i] + d1); if (i < n - 1) v = Math.min(v, D[(j + 1) * n + i + 1] + d2); if (i > 0) v = Math.min(v, D[(j + 1) * n + i - 1] + d2); }
    D[j * n + i] = v;
  }
  // (a cell's distance is from its middle; a point anywhere in it may be half a cell nearer)
  return (x, z) => { const i = ci(x), j = cj(z); return i < 0 || j < 0 || i >= n || j >= n ? 1e9 : Math.max(0, D[j * n + i] - C * 0.71); };
}
// who sleeps in each pod: the sleepers (src/sleeper.js SLEEPERS, n of them) in an order of the seed's, so no two pods
// of a rescue have the same person
export function sleeperOrder(seed, n = 8) {
  const R = rng(subSeed(seed, 'pod sleepers')), o = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

// ── where they lie ───────────────────────────────────────────────────────────────────────────────────────────────
export function podsPlan(land, seed, { site, tris }) {
  const R = rng(subSeed(seed, 'pods')), L = land.landing, n = podCount(seed), near = nearWreck(tris, site.x, site.z), order = sleeperOrder(seed);
  // (out from the landing place's middle toward the wreck; lying along the ring, its front (its screen and keypad, where
  // it is opened) toward the ring, where the Medic sets down: the pod's x then runs (-cos a, sin a), its front (-sin a,
  // -cos a))
  const a = site.a ?? Math.atan2(site.x - L.x, site.z - L.z), rx = Math.sin(a), rz = Math.cos(a), along = a + Math.PI;
  const clearR = L.flat + PODS.ring, far = (site.dist ?? hyp(site.x - L.x, site.z - L.z)) + 16;
  // every place tried: out from the ring toward the wreck and past it, either way along the ring; each a turn of its own
  const tried = [];
  for (let r = clearR + PODS.foot.wide / 2; r <= far; r += PODS.step) for (let t = -24; t <= 24; t += PODS.step) {
    const cx = L.x + rx * r + rz * t, cz = L.z + rz * r - rx * t, yaw = along + (R() * 2 - 1) * PODS.turn;
    const ring = FOOT.map(([x, z]) => toWorld(cx, cz, yaw, x, z));
    // never on the landing place, nor near it
    if (ring.some(([x, z]) => hyp(wrapD(x - L.x), wrapD(z - L.z)) < clearR)) continue;
    // clear of the wreck
    const dw = Math.min(...ring.map(([x, z]) => near(x, z)));
    if (dw < PODS.wreck[0]) continue;
    // even ground
    let lo = Infinity, hi = -Infinity; for (const [x, z] of ring) { const h = land.heightAt(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (hi - lo > PODS.spread) continue;
    tried.push({ x: cx, z: cz, yaw, ring, r, t, wreck: dw, uneven: hi - lo, luck: R() });
  }
  // chosen one at a time: near the wreck (about PODS.wreck[1]), near the ring (the walk from the Medic), on even ground,
  // a little luck; after the first, near the ones already chosen (about PODS.apart[1] away) and never nearer than
  // PODS.apart[0]
  const chosen = [];
  for (let k = 0; k < n; k++) {
    let best = null, bs = Infinity;
    for (const c of tried) {
      let gap = Infinity; for (const P of chosen) { gap = Math.min(gap, gapBetween(c, P)); if (gap < PODS.apart[0]) break; }
      if (gap < PODS.apart[0]) continue;
      let s = Math.abs(c.wreck - PODS.wreck[1]) * 0.6 + (c.r - clearR) * 0.12 + c.uneven * 3 + c.luck * 0.8;
      if (chosen.length) s += Math.abs(gap - PODS.apart[1]) * 0.7;
      if (s < bs) { bs = s; best = c; }
    }
    if (!best) break;
    chosen.push(best);
  }
  // each set on the ground: leant with the ground under its footprint (no more than PODS.tilt), then lowered until its
  // highest foot point is PODS.sink[0] under the ground there
  const pods = chosen.map((c, i) => {
    const nrm = plane(land, c.ring), ang = Math.min(PODS.tilt, Math.acos(Math.min(1, nrm[1])));
    // (the pod's own axes: x along (cos yaw, 0, -sin yaw), y up, z across (sin yaw, 0, cos yaw), then leant about the
    // line square to the slope by ang)
    let X = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)], Y = [0, 1, 0], Z = [Math.sin(c.yaw), 0, Math.cos(c.yaw)];
    const hl = hyp(nrm[0], nrm[2]);
    if (ang > 1e-4 && hl > 1e-6) { const ax = [nrm[2] / hl, 0, -nrm[0] / hl]; X = rot(X, ax, ang); Y = rot(Y, ax, ang); Z = rot(Z, ax, ang); }
    // its foot points where they lie, and how far each is above the ground under it
    const at = (y0) => FOOT.map(([x, z]) => [c.x + X[0] * x + Z[0] * z, y0 + X[1] * x + Z[1] * z, c.z + X[2] * x + Z[2] * z]);
    let y = land.heightAt(c.x, c.z), above = at(y).map((p) => p[1] - land.heightAt(p[0], p[2]));
    y -= Math.max(...above) + PODS.sink[0];
    const foot = at(y), under = foot.map((p) => +(land.heightAt(p[0], p[2]) - p[1]).toFixed(3));
    const mat = [X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, c.x, y, c.z, 1];
    return { x: c.x, z: c.z, y, yaw: c.yaw, tilt: +ang.toFixed(3), mat, foot, under, wreck: +c.wreck.toFixed(2), ring: c.ring, look: order[i % order.length] };
  });
  return { pods, count: n, tried: tried.length };
}
// v turned about the unit axis by a (Rodrigues)
function rot(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c));
}
// the footprints as triangles (x, y, z) in the world, a little bigger than the pods (for clearUnder's own margin)
export function footprintTris(plan) {
  return plan.pods.map((P) => {
    const hx = PODS.foot.long / 2, hz = PODS.foot.wide / 2, c = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => { const [wx, wz] = toWorld(P.x, P.z, P.yaw, x, z); return [wx, P.y, wz]; });
    return { tris: Float32Array.from([...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]]) };
  });
}
