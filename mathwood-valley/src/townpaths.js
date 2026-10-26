// TOWN PATHS: the ground the townsfolk walk on, and their way from one place to another. Plain numbers only (no three.js,
// no page), so the tests can run it as it is. src/townpeople.js builds the grid from the world and asks for routes.
//
// THE GRID: the town's ground in squares (`cell` metres), each with what a step on it costs, in tenths of a metre's
// walk: 0 where nobody can go (a wall, a fence, water, a steep bank), ROAD on the dirt of the square, the trail and the
// paths, GRASS on the meadow; a step beside a wall costs WALL more, so people keep a little way off walls. A route keeps
// to the paths unless cutting across the grass is much shorter.
// THE ROUTES: A* over the squares (8 ways; never across a wall's corner), then pulled straight where a straight line
// crosses nothing dearer than the squares it replaces (so nobody leaves the square's dirt to cut across the grass
// beside it), with the corners rounded a little.
//
//   gridSteps({ x0, z0, x1, z1, cell, ground(x, z) -> cost }) -> generator; its return value is the grid G (a slice of
//                         rows a step, so a big town is laid over a few frames)
//   cellAt(G, x, z), centre(G, k) -> [x, z], openAt(G, x, z) -> true where someone can stand
//   nearestOpen(G, x, z, reach) -> the nearest open square's index within `reach` squares (-1: none)
//   shut(G, box, mine) / reopen(G)   squares closed for a while (a wagon standing in the way: { x, z, w, d, rot });
//                         reopen() puts back every square shut so; with `mine` (a Set) the squares are remembered as
//                         that shutter's, and reopenSome(G, mine) opens just those again (once no other shutter holds them)
//   route(G, a, b, { most }) -> a route { xz: Float32Array [x0, z0, x1, z1, ...], cum, total } from a to b ({ x, z }), or
//                         null when b can't be reached (most: the most squares looked at before giving up)
//   along(route, s, out) -> out { x, z, dx, dz } s metres along (dx, dz: the way it runs there)
//   routeLength(route), reversedRoute(route)
//   COST                 the costs
export const COST = { ROAD: 10, GRASS: 15, WALL: 8, MOST: 250 };

const SQ2 = Math.SQRT2, DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];

export function* gridSteps({ x0, z0, x1, z1, cell = 1, ground }) {
  const W = Math.max(1, Math.ceil((x1 - x0) / cell)), H = Math.max(1, Math.ceil((z1 - z0) / cell)), N = W * H;
  const cost = new Uint8Array(N), wall = new Uint8Array(N);
  for (let j = 0; j < H; j++) {
    const z = z0 + (j + 0.5) * cell;
    for (let i = 0; i < W; i++) { const c = ground(x0 + (i + 0.5) * cell, z); cost[j * W + i] = Math.max(0, Math.min(COST.MOST, Math.round(+c || 0))); }
    if ((j & 7) === 7) yield;
  }
  // a little way off walls: the squares beside one cost more
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (cost[k]) continue;
    for (let d = 0; d < 8; d++) { const a = i + DI[d], b = j + DJ[d]; if (a >= 0 && b >= 0 && a < W && b < H && cost[b * W + a]) wall[b * W + a] = 1; }
  }
  for (let k = 0; k < N; k++) if (wall[k] && cost[k]) cost[k] = Math.min(COST.MOST, cost[k] + COST.WALL);
  return { x0, z0, cell, W, H, cost, base: null, g: new Float32Array(N), par: new Int32Array(N), seen: new Uint32Array(N), done: new Uint32Array(N), stamp: 0 };
}

export const cellAt = (G, x, z) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell); return i < 0 || j < 0 || i >= G.W || j >= G.H ? -1 : j * G.W + i; };
export const centre = (G, k) => [G.x0 + (k % G.W + 0.5) * G.cell, G.z0 + (Math.floor(k / G.W) + 0.5) * G.cell];
export const openAt = (G, x, z) => { const k = cellAt(G, x, z); return k >= 0 && G.cost[k] > 0; };

export function nearestOpen(G, x, z, reach = 6) {
  const ci = Math.floor((x - G.x0) / G.cell), cj = Math.floor((z - G.z0) / G.cell); let best = -1, bd = Infinity;
  for (let j = Math.max(0, cj - reach); j <= Math.min(G.H - 1, cj + reach); j++) for (let i = Math.max(0, ci - reach); i <= Math.min(G.W - 1, ci + reach); i++) {
    const k = j * G.W + i; if (!G.cost[k]) continue;
    const d = (i + 0.5 - (x - G.x0) / G.cell) ** 2 + (j + 0.5 - (z - G.z0) / G.cell) ** 2; if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// squares shut for a while (each remembered with what it cost, so reopen() can put it back)
export function shut(G, { x, z, w, d, rot = 0 }, mine = null) {
  if (!G.base) G.base = new Map();
  if (mine && !G.held) G.held = new Map();
  const c = Math.cos(rot), s = Math.sin(rot), R = Math.hypot(w, d) / 2 + G.cell;
  const i0 = Math.max(0, Math.floor((x - R - G.x0) / G.cell)), i1 = Math.min(G.W - 1, Math.ceil((x + R - G.x0) / G.cell));
  const j0 = Math.max(0, Math.floor((z - R - G.z0) / G.cell)), j1 = Math.min(G.H - 1, Math.ceil((z + R - G.z0) / G.cell));
  let n = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = G.x0 + (i + 0.5) * G.cell - x, dz = G.z0 + (j + 0.5) * G.cell - z;
    if (Math.abs(c * dx - s * dz) <= w / 2 + G.cell * 0.5 && Math.abs(s * dx + c * dz) <= d / 2 + G.cell * 0.5) {
      const k = j * G.W + i;
      if (G.cost[k]) { if (!G.base.has(k)) G.base.set(k, G.cost[k]); G.cost[k] = 0; n++; }
      // (whose it is: a square two wagons stand over opens only once both have gone)
      if (mine && G.base.has(k) && !mine.has(k)) { mine.add(k); G.held.set(k, (G.held.get(k) || 0) + 1); }
    }
  }
  return n;
}
export function reopen(G) { if (!G.base) return; for (const [k, v] of G.base) G.cost[k] = v; G.base.clear(); if (G.held) G.held.clear(); }
// the squares one shutter closed (`mine`, the Set passed to shut) opened again, unless another still holds them
export function reopenSome(G, mine) {
  if (!G.base || !mine) return 0;
  let n = 0;
  for (const k of mine) {
    const left = (G.held && G.held.get(k) || 1) - 1;
    if (left > 0) { G.held.set(k, left); continue; }
    if (G.held) G.held.delete(k);
    if (G.base.has(k)) { G.cost[k] = G.base.get(k); G.base.delete(k); n++; }
  }
  mine.clear();
  return n;
}

// ── A* ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
function heapPush(K, V, k, v) { let c = K.length; K.push(k); V.push(v); while (c > 0) { const p = (c - 1) >> 1; if (V[p] <= v) break; K[c] = K[p]; V[c] = V[p]; c = p; } K[c] = k; V[c] = v; }
function heapPop(K, V) {
  const top = K[0], lk = K.pop(), lv = V.pop(), n = K.length;
  if (n) { let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c, mv = lv; if (l < n && V[l] < mv) { m = l; mv = V[l]; } if (r < n && V[r] < mv) m = r; if (m === c) break; K[c] = K[m]; V[c] = V[m]; c = m; } K[c] = lk; V[c] = lv; }
  return top;
}

export function route(G, a, b, { most = 60000 } = {}) {
  const W = G.W, cost = G.cost;
  let s = cellAt(G, a.x, a.z), t = cellAt(G, b.x, b.z);
  if (s < 0 || !cost[s]) s = nearestOpen(G, a.x, a.z, 4);
  if (t < 0 || !cost[t]) t = nearestOpen(G, b.x, b.z, 4);
  if (s < 0 || t < 0) return null;
  const st = ++G.stamp, g = G.g, par = G.par, seen = G.seen, done = G.done, ti = t % W, tj = (t / W) | 0;
  const h = (k) => { const di = Math.abs(k % W - ti), dj = Math.abs(((k / W) | 0) - tj); return (Math.max(di, dj) + (SQ2 - 1) * Math.min(di, dj)) * COST.ROAD * 1.02; };
  const K = [], V = []; g[s] = 0; seen[s] = st; par[s] = -1; heapPush(K, V, s, h(s));
  let n = 0, found = false;
  while (K.length) {
    const k = heapPop(K, V); if (done[k] === st) continue; done[k] = st;
    if (k === t) { found = true; break; }
    if (++n > most) break;
    const i = k % W, j = (k / W) | 0, ck = cost[k], gk = g[k];
    for (let d = 0; d < 8; d++) {
      const ni = i + DI[d], nj = j + DJ[d]; if (ni < 0 || nj < 0 || ni >= W || nj >= G.H) continue;
      const q = nj * W + ni, cq = cost[q]; if (!cq || done[q] === st) continue;
      if (d >= 4 && (!cost[j * W + ni] || !cost[nj * W + i])) continue;   // (never across a wall's corner)
      const ng = gk + (ck + cq) * (d >= 4 ? SQ2 * 0.5 : 0.5);
      if (seen[q] !== st || ng < g[q]) { seen[q] = st; g[q] = ng; par[q] = k; heapPush(K, V, q, ng + h(q)); }
    }
  }
  if (!found) return null;
  const cells = []; for (let k = t; k !== -1; k = par[k]) cells.push(k); cells.reverse();
  const kept = pull(G, cells);
  const pts = [[a.x, a.z]];
  for (let q = 1; q < kept.length - 1; q++) pts.push(centre(G, kept[q]));
  pts.push([b.x, b.z]);
  // (a start or end off the open ground, a door's step say: through the nearest open square's middle)
  if (cellAt(G, a.x, a.z) !== s && kept.length > 1) pts.splice(1, 0, centre(G, s));
  if (cellAt(G, b.x, b.z) !== t && kept.length > 1) pts.splice(pts.length - 1, 0, centre(G, t));
  return makeRoute(roundCorners(pts));
}

// straightened: from each square on to the furthest one along that a straight line reaches crossing nothing dearer
// than the route's own squares between them
function pull(G, cells) {
  const n = cells.length; if (n < 3) return cells;
  const out = [cells[0]]; let a = 0;
  while (a < n - 1) {
    let good = a + 1, step = 2, bad = -1;
    while (a + step < n) { if (clear(G, cells, a, a + step)) { good = a + step; step *= 2; } else { bad = a + step; break; } }
    if (bad < 0 && good < n - 1) { if (clear(G, cells, a, n - 1)) good = n - 1; else bad = n - 1; }
    if (bad > 0) { let lo = good, hi = bad; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (clear(G, cells, a, m)) lo = m; else hi = m; } good = lo; }
    out.push(cells[good]); a = good;
  }
  return out;
}
function clear(G, cells, a, b) {
  const W = G.W, cost = G.cost; let most = 0;
  for (let q = a; q <= b; q++) most = Math.max(most, cost[cells[q]]);
  const ai = cells[a] % W + 0.5, aj = ((cells[a] / W) | 0) + 0.5, bi = cells[b] % W + 0.5, bj = ((cells[b] / W) | 0) + 0.5;
  const L = Math.hypot(bi - ai, bj - aj), steps = Math.ceil(L * 3), ux = (bj - aj) / (L || 1) * 0.3, uz = -(bi - ai) / (L || 1) * 0.3;
  for (let q = 0; q <= steps; q++) {
    const t = q / steps, x = ai + (bi - ai) * t, z = aj + (bj - aj) * t;
    for (const o of [0, 1, -1]) { const i = Math.floor(x + ux * o), j = Math.floor(z + uz * o); if (i < 0 || j < 0 || i >= W || j >= G.H) return false; const c = cost[j * W + i]; if (!c || c > most) return false; }
  }
  return true;
}
// the corners rounded: each turn a short curve through it, up to 1.2 m out from the corner
function roundCorners(pts) {
  if (pts.length < 3) return Float32Array.from(pts.flat());
  const out = [pts[0][0], pts[0][1]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [px, pz] = pts[i], [bx, bz] = pts[i + 1], la = Math.hypot(px - ax, pz - az), lb = Math.hypot(bx - px, bz - pz);
    const r = Math.min(1.2, la * 0.4, lb * 0.4);
    if (r < 0.05) { out.push(px, pz); continue; }
    const sx = px + (ax - px) / la * r, sz = pz + (az - pz) / la * r, ex = px + (bx - px) / lb * r, ez = pz + (bz - pz) / lb * r;
    for (let q = 0; q <= 3; q++) { const t = q / 3, u = 1 - t; out.push(u * u * sx + 2 * u * t * px + t * t * ex, u * u * sz + 2 * u * t * pz + t * t * ez); }
  }
  out.push(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  return Float32Array.from(out);
}

export function makeRoute(xz) {
  const n = xz.length / 2, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xz[i * 2] - xz[i * 2 - 2], xz[i * 2 + 1] - xz[i * 2 - 1]);
  return { xz, cum, total: n ? cum[n - 1] : 0 };
}
export const routeLength = (r) => (r ? r.total : Infinity);
export function reversedRoute(r) {
  const n = r.xz.length / 2, xz = new Float32Array(r.xz.length);
  for (let i = 0; i < n; i++) { xz[i * 2] = r.xz[(n - 1 - i) * 2]; xz[i * 2 + 1] = r.xz[(n - 1 - i) * 2 + 1]; }
  return makeRoute(xz);
}
export function along(r, s, out = { x: 0, z: 0, dx: 0, dz: 1, seg: 0 }, seg = 0) {
  const n = r.cum.length;
  if (n < 2) { out.x = r.xz[0]; out.z = r.xz[1]; out.dx = 0; out.dz = 1; out.seg = 0; return out; }
  s = Math.max(0, Math.min(r.total, s));
  let i = Math.min(seg, n - 2); while (i > 0 && r.cum[i] > s) i--; while (i < n - 2 && r.cum[i + 1] < s) i++;
  const L = r.cum[i + 1] - r.cum[i] || 1e-6, t = (s - r.cum[i]) / L, ax = r.xz[i * 2], az = r.xz[i * 2 + 1], bx = r.xz[i * 2 + 2], bz = r.xz[i * 2 + 3];
  out.x = ax + (bx - ax) * t; out.z = az + (bz - az) * t; out.dx = (bx - ax) / L; out.dz = (bz - az) / L; out.seg = i;
  return out;
}
