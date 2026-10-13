// THE WAGON JOB'S PLAN, in plain numbers (no three.js, so the tests can load it): the road the wagon rolls round, where
// the riders ride round it, and the job's small rules. Used by src/missions/wagonjob.js; tested in
// tests/wagonjob.test.mjs.

// The road: a closed loop over the open, nearly level land east of the pasture (checked on the real land with
// ~/pw/bandit-math/rigs/bandits/road_check.cjs: nothing blocks it or 12 m to either side, no water, gentle slopes; it
// keeps more than 80 m from the middle of the round-up's pasture, out of reach of its target ring, and about 15 m from
// the Hollis camp at its nearest). The wagon starts at its west end, the nearest point to the pasture.
export const ROAD_POINTS = (() => {
  // an oval 144 by 92 m: its tightest bends (the ends) are about 24 m across, gentle for a wagon and a team
  const c = { x: 316, z: -251 }, rx = 72, rz = 46, n = 16, pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / n) * Math.PI * 2;
    pts.push([c.x + Math.cos(a) * rx, c.z + Math.sin(a) * rz]);
  }
  return pts;
})();

// A smooth closed road through points (a centripetal Catmull-Rom curve: it passes through every point without loops
// or overshoot), measured into steps of `step` metres.
//   road.at(s, out) at s metres along (any s: it wraps) -> { x, z, h (heading: facing (sin h, cos h)), nx, nz (one
//                   metre to the left-hand side) }
//   road.length, road.nearest(x, z) -> s, road.track(x, z, s, win) -> s (the nearest within win metres of s: cheap),
//   road.gap(a, b) -> b - a along the loop the short way round (-length / 2 .. length / 2)
export function makeRoad(points, step = 1) {
  const P = points, m = P.length, dense = [];
  const knot = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    for (let k = 0; k < 40; k++) {
      const t = t1 + (t2 - t1) * (k / 40), pt = [0, 0];
      for (let d = 0; d < 2; d++) {
        const A1 = (t1 - t) / (t1 - t0) * p0[d] + (t - t0) / (t1 - t0) * p1[d];
        const A2 = (t2 - t) / (t2 - t1) * p1[d] + (t - t1) / (t2 - t1) * p2[d];
        const A3 = (t3 - t) / (t3 - t2) * p2[d] + (t - t2) / (t3 - t2) * p3[d];
        const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        pt[d] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      }
      dense.push(pt);
    }
  }
  // the length along it, then points every `step` metres
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const length = cum[cum.length - 1], n = Math.max(8, Math.round(length / step)), seg = length / n;
  const X = new Float64Array(n), Z = new Float64Array(n), H = new Float64Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const want = i * seg; while (cum[j + 1] < want) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], f = (want - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    X[i] = a[0] + (b[0] - a[0]) * f; Z[i] = a[1] + (b[1] - a[1]) * f;
  }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, k = (i + n - 1) % n; H[i] = Math.atan2(X[j] - X[k], Z[j] - Z[k]); }
  const road = { length, points, n };
  road.at = (s, out = {}) => {
    let u = (((s % length) + length) % length) / seg; const i = Math.floor(u) % n, j = (i + 1) % n; u -= Math.floor(u);
    out.x = X[i] + (X[j] - X[i]) * u; out.z = Z[i] + (Z[j] - Z[i]) * u;
    const dh = Math.atan2(Math.sin(H[j] - H[i]), Math.cos(H[j] - H[i]));
    out.h = H[i] + dh * u; out.nx = Math.cos(out.h); out.nz = -Math.sin(out.h);
    return out;
  };
  road.nearest = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } return best * seg; };
  road.track = (x, z, s, win = 30) => {
    const i0 = Math.round(s / seg), w = Math.ceil(win / seg); let best = s, bd = Infinity;
    for (let k = -w; k <= w; k++) { const i = ((i0 + k) % n + n) % n, d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = (i0 + k) * seg; } }
    return best;
  };
  road.gap = (a, b) => { const d = (((b - a) % length) + length) % length; return d > length / 2 ? d - length : d; };
  return road;
}

// where each rider rides round the wagon: [side (1 left, -1 right), metres out from the road's middle, metres ahead of
// the wagon (behind: negative)]. The first few are dealt first: close in front and beside, the rest behind.
export const SLOTS = [[1, 6, 5], [-1, 6.5, 3], [1, 9, -3], [-1, 9.5, -5], [1, 6, -10], [-1, 7, -11], [1, 11, 9], [-1, 11, 8],
  [1, 12, -15], [-1, 12, -16], [1, 8, 14], [-1, 8, -21]];

// "not in the 6-herd" from the times trainer reads "not in the 6-Gang" out here
export const gangLine = (line) => String(line || '').replace(/(\d+)-herd/g, '$1-Gang');

// the sacks a roped bandit drops for his number: 24 in the 6-Gang drops 4 sacks of 6 (on a missing-number card the
// number IS how many sacks of the table)
export function sacksFor(n, table, kind = 'rule') {
  if (!table) return { sacks: 0, per: 0 };
  if (kind === 'missing') return { sacks: n, per: table };
  return n % table === 0 ? { sacks: n / table, per: table } : { sacks: 0, per: table };
}

// The wagon's speed notch (an index into the job's speeds) after a wave. The math and the speed are two separate dials
// and are never raised together: a wave that moved the kid up a step leaves the speed alone, a new table opening slows
// the wagon right back to a walk, a clean wave otherwise picks up the pace a notch, and a rough one (two misses or more)
// eases it a notch.
export function nextSpeed(level, { misses = 0, stepUp = false, newTable = false, top = 3 } = {}) {
  if (newTable) return 0;
  if (misses >= 2) return Math.max(0, level - 1);
  if (misses === 0 && !stepUp) return Math.min(top, level + 1);
  return level;
}
