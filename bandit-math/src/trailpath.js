// TRAIL PATH: the way Old Hob's hoofprints take from the player to a job, worked out over a coarse grid of squares
// laid over the land round the two ends. No three.js and no world here, so it can be tested on its own: the caller
// says what each spot of ground costs to cross.
//
//   const S = makePathSearch({ from: {x, z}, to: {x, z}, cost, cell = 2, pad = 40, maxCells = 90000 })
//     cost(x, z) -> how hard the ground at that spot is to cross: 1 is open grass, less is a road or trail (cheaper,
//                   so the way follows it), more is wet or steep, Infinity is no way through (a wall, deep water)
//     cell:        the grid's square size (m); pad: metres of land round the two ends that the way may use
//                  (a bigger area than maxCells squares gets bigger squares)
//   S.step(n)       works through up to n more squares; returns 'running', 'done' or 'fail'
//   S.path          once done: [[x, z], ...] from `from` to `to`, smoothed (straight where it can, round at the turns)
//
//   findPath(opts)  the same, all at once: the smoothed path, or null if there is no way through
//   smoothPath(pts, cost, { sample = 1 })   the string-pulling and rounding on their own (pts: [[x, z], ...])
//
// The search is A* (it always works on the square that looks closest to the end, counting the way so far): eight ways
// out of each square, the diagonals costing their extra length. Its guess at the rest of the way is a little under the
// straight-line distance, so it finds a good way quickly rather than insisting on the very best one.

const DIAG = Math.SQRT2;
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG]];

export function makePathSearch({ from, to, cost, cell = 2, pad = 40, maxCells = 90000, guess = 0.8 }) {
  const x0 = Math.min(from.x, to.x) - pad, z0 = Math.min(from.z, to.z) - pad;
  const x1 = Math.max(from.x, to.x) + pad, z1 = Math.max(from.z, to.z) + pad;
  let c = cell;
  while (Math.ceil((x1 - x0) / c) * Math.ceil((z1 - z0) / c) > maxCells) c *= 1.25;
  const nx = Math.ceil((x1 - x0) / c), nz = Math.ceil((z1 - z0) / c), N = nx * nz;
  const cx = (i) => x0 + (i + 0.5) * c, cz = (j) => z0 + (j + 0.5) * c;
  const own = new Float32Array(N).fill(-1);           // each square's own cost, worked out when first met (-1: not yet)
  const g = new Float32Array(N).fill(Infinity);       // the cheapest way found so far from the start to each square
  const came = new Int32Array(N).fill(-1);            // the square it was reached from
  const shut = new Uint8Array(N);                     // done with
  const costOf = (k) => { if (own[k] < 0) { const v = cost(cx(k % nx), cz((k / nx) | 0)); own[k] = v > 0 ? v : Infinity; } return own[k]; };
  const cellOf = (p) => Math.min(nx - 1, Math.max(0, Math.floor((p.x - x0) / c))) + Math.min(nz - 1, Math.max(0, Math.floor((p.z - z0) / c))) * nx;
  // an end standing on a spot with no way through (a doorstep, a tent) starts from the nearest open square instead
  const open = (k) => {
    if (costOf(k) < Infinity) return k;
    const i0 = k % nx, j0 = (k / nx) | 0;
    for (let r = 1; r <= 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      if (costOf(i + j * nx) < Infinity) return i + j * nx;
    }
    return -1;
  };
  const start = open(cellOf(from)), goal = open(cellOf(to));
  const gi = goal % nx, gj = (goal / nx) | 0;
  const h = (k) => { const dx = Math.abs(k % nx - gi), dz = Math.abs(((k / nx) | 0) - gj); return guess * (Math.max(dx, dz) + (DIAG - 1) * Math.min(dx, dz)); };
  // the squares waiting to be worked on, cheapest guess first (a binary heap)
  const heap = [], pri = [];
  const push = (k, p) => { let i = heap.length; heap.push(k); pri.push(p); while (i > 0) { const u = (i - 1) >> 1; if (pri[u] <= p) break; heap[i] = heap[u]; pri[i] = pri[u]; i = u; } heap[i] = k; pri[i] = p; };
  const pop = () => {
    const top = heap[0], lk = heap.pop(), lp = pri.pop();
    if (heap.length) { let i = 0; const n = heap.length; for (;;) { let m = 2 * i + 1; if (m >= n) break; if (m + 1 < n && pri[m + 1] < pri[m]) m++; if (pri[m] >= lp) break; heap[i] = heap[m]; pri[i] = pri[m]; i = m; } heap[i] = lk; pri[i] = lp; }
    return top;
  };
  let status = start < 0 || goal < 0 ? 'fail' : 'running';
  if (status === 'running') { g[start] = 0; push(start, h(start)); }
  const S = { path: null, cell: c, get status() { return status; } };
  S.step = (n = Infinity) => {
    while (status === 'running' && n-- > 0) {
      if (!heap.length) { status = 'fail'; break; }
      const k = pop();
      if (shut[k]) continue;
      shut[k] = 1;
      if (k === goal) { status = 'done'; break; }
      const i = k % nx, j = (k / nx) | 0, ck = costOf(k);
      for (const [di, dj, len] of NB) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const m = a + b * nx; if (shut[m]) continue;
        const cm = costOf(m); if (cm === Infinity) continue;
        // (a diagonal step may not squeeze between two closed squares)
        if (di && dj && (costOf(i + di + j * nx) === Infinity || costOf(i + (j + dj) * nx) === Infinity)) continue;
        const ng = g[k] + len * (ck + cm) / 2;
        if (ng < g[m]) { g[m] = ng; came[m] = k; push(m, ng + h(m)); }
      }
    }
    if (status === 'done' && !S.path) {
      const pts = [];
      for (let k = goal; k >= 0; k = came[k]) { pts.push([cx(k % nx), cz((k / nx) | 0)]); if (k === start) break; }
      pts.reverse();
      // the true ends in place of their squares' middles (when the ground there is passable)
      if (cost(from.x, from.z) < Infinity) pts[0] = [from.x, from.z];
      if (cost(to.x, to.z) < Infinity) { if (pts.length > 1) pts[pts.length - 1] = [to.x, to.z]; else pts.push([to.x, to.z]); }
      S.path = smoothPath(pts, cost, { sample: Math.min(1, c / 2) });
    }
    return status;
  };
  return S;
}

export function findPath(opts) {
  const S = makePathSearch(opts);
  S.step();
  return S.status === 'done' ? S.path : null;
}

// the cost of crossing the ground in a straight line from a to b (Infinity if anything on the way is closed)
function lineCost(a, b, cost, sample) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / sample));
  let sum = 0;
  for (let s = 0; s <= n; s++) { const t = s / n, v = cost(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); if (v === Infinity) return Infinity; sum += (s === 0 || s === n ? 0.5 : 1) * v; }
  return sum * L / n;
}

// String-pulling: from each corner, go straight to the furthest point ahead that a straight line reaches without costing
// more than the grid's way there (so a straight cut over open grass is taken, but not one that leaves a road for rough
// ground). Then the turns are rounded off (each corner cut a quarter of the way in, twice), where the ground allows.
export function smoothPath(pts, cost, { sample = 1, reach = 40 } = {}) {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]]);
  // the grid way's own cost from the first point to each point
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + lineCost(pts[i - 1], pts[i], cost, sample));
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let best = i + 1;
    for (let j = Math.min(pts.length - 1, i + reach); j > i + 1; j--) {
      const lc = lineCost(pts[i], pts[j], cost, sample);
      if (lc <= (along[j] - along[i]) * 1.02 + 1e-6) { best = j; break; }
    }
    out.push(pts[best]); i = best;
  }
  let p = out;
  for (let pass = 0; pass < 2; pass++) {
    const q = [p[0]];
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k], b = p[k + 1];
      const A = [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], B = [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75];
      if (k > 0) q.push(A);
      if (k < p.length - 2) q.push(B);
    }
    q.push(p[p.length - 1]);
    // (a rounded corner that would cut over closed ground keeps the sharp corner instead)
    let ok = true;
    for (let k = 1; k < q.length && ok; k++) if (lineCost(q[k - 1], q[k], cost, sample) === Infinity) ok = false;
    if (!ok) break;
    p = q;
  }
  return p.map((v) => [v[0], v[1]]);
}

// how far along a path (m from its start) the point nearest to (x, z) is, and how far off the path that is
export function nearestAlong(pts, x, z) {
  let best = Infinity, at = 0, run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz, L = Math.sqrt(L2);
    const t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
    const d = Math.hypot(ax + vx * t - x, az + vz * t - z);
    if (d < best) { best = d; at = run + t * L; }
    run += L;
  }
  if (pts.length === 1) best = Math.hypot(pts[0][0] - x, pts[0][1] - z);
  return { along: at, off: best, length: run };
}
