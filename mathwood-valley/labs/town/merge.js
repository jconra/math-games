// THE TOWN LAB'S SAVE MERGE, the tidy-up's second half (the game's maker, 2026-10-30: "Even if it's not identical it would be
// fine as long as its close. For example, if the street is made up of 5 strokes, but it could be done with one wide one.
// That would be okay, even if it left some alleys with a bit more dirt."). After tidy.js has left out the strokes that do
// nothing, brush strokes of one sort that overlap become one, and each stroke's path keeps only the points it needs, as long
// as the ground comes out close. Each change is tried, the ground worked out before and after on a fine grid, and kept only if
//   - what differs is small: in each part of the ground no more than MERGE.share of the ground the smaller strokes add to the
//     biggest of them (one stroke alone: of its own), a change of thickness counted too; and what comes or goes is at the
//     edges (within MERGE.edge m, or MERGE.edgeShare of the brush up to MERGE.edgeMost m, of where that part's edge was)
//   - no dirt, plants or lawn come onto a building, a prop, a placed plant or the ground in front of a door
//     (guard.taken), and nothing is taken from in front of a door (guard.door)
//   - no footpath is opened or closed: the patches of dirt, and the ground between them, stay the same patches
//   - the fences and gates stand exactly as before
// Joins are always measured against the strokes as they were before the merge began, so changes never add up past that;
// a line's points left out (it moves by a few centimetres at most) against the strokes just before.
// The parts of the ground, as the game lays them (world/objects/plantviews.js, world/valley.js drawPaths):
//   dirt         the footpaths' worn core: a footpath stroke DIRT x its brush wide, a rubbed-out one its whole brush
//   painted      each kind of painted plant (lawn, flowers, trees, rocks): where it grows and how thickly (a later Clear
//                takes it away), counted as differing where it comes or goes or its thickness changes by over a quarter
//   wild         where the plants, trees and rocks that grow by themselves are kept back (any of their strokes or a Clear;
//                nothing grows on the dirt anyway)
// What may become one: footpaths (the new one as wide as either; density, size and seed don't matter to the dirt), footpaths
// rubbed out, a plant kind painted at one density and size, Clears (with any plant chosen: they all clear alike), the
// fences' Clears (only with the fences standing exactly as they did).
// Never touched: the shipped strokes (keep), the fences and gates drawn, kinds this doesn't know.
// The new stroke takes the place in the order of one of the strokes it stands for (whichever comes out closer), the
// first one's kind and seed. Strokes are tried two at a time and again until nothing more joins; each kept change is listed.
//   mergeStrokes(planting, { PLANT, keep, guard, step }) -> { strokes (the ones to save, new objects where changed, in
//     order), merged: [{ from: [stroke], to: stroke | null, what: 'join' | 'drop' | 'points', d (what differs: differ) }],
//     groups: [{ to, from: [stroke] }] each new stroke and the ones it stands for }
//   makeGuard({ rects, spots, doors, inside }) -> { taken(x, z), door(x, z) }   rects: [{ x, z, rot (radians), w, d }] the
//     buildings' and props' footprints; spots: [{ x, z, r }] placed plants; doors: [{ x, z, ox, oz, half }] (their way
//     out and half their width: the ground in front, out to DOOR.out m and DOOR.side m past either side, is kept);
//     inside(x, z): true in a code-built building (its walls, rooms, porch)
//   groundOf(strokes, G, ctx, seen) / differ(A, B, G, guard) the measuring, for the tests and the rigs
import { plantSorts } from '../../world/objects/plantviews.js';
import { fencesStanding } from './tidy.js';

export const DIRT = 0.55;   // (the dirt's half-width as a share of a footpath brush's radius: world/valley.js drawPaths, src/townpeople.js)
export const MERGE = { step: 0.2, cells: 250000, share: 0.15, edge: 1, edgeShare: 0.5, edgeMost: 2, tol: 0.03, tolMost: 0.1, thick: 0.25, point: 0.5 };
//   step: the grid (m; coarser where it would have more than `cells` cells); share, edge, edgeShare, edgeMost: what may
//   differ (above); tol, tolMost: how far a path's line may move when points are left out (a share of the brush, at most
//   tolMost m); thick: the share a painted kind's thickness may change before it counts as differing; point: what a point
//   of a new line counts for (m2 of difference) when choosing between shapes that all pass
export const DOOR = { out: 4, back: 0.5, side: 1.5 };   // (the ground in front of a door: as ~/pw/bandit-math/rigs/town/clearcheck.cjs)

// ── what a stroke is, for merging ─────────────────────────────────────────────────────────────────────────────────────
// the strokes that may become one share a key; null: never touched
export function mergeKey(st, PLANT, SORT = plantSorts(PLANT)) {
  if (!st || !Array.isArray(st.pts) || !st.pts.length || !(st.r > 0)) return null;
  if (SORT.fence(st.kind)) return st.mode === 'clear' ? 'unfence:' + st.kind : null;
  if (st.kind === PLANT.NOPATH) return 'nopath';
  if (st.mode === 'clear') return SORT.rock(st.kind) ? 'clear:rock' : SORT.plant(st.kind) || SORT.tree(st.kind) || SORT.path(st.kind) ? 'clear' : null;
  if (st.kind === PLANT.PATH) return 'path';
  if (SORT.plant(st.kind) || SORT.tree(st.kind) || SORT.rock(st.kind)) return `paint:${st.kind}:${st.density}:${st.size}`;
  return null;
}
// how far from its line a stroke works on the ground
const reachOf = (st, PLANT) => (st.kind === PLANT.PATH && st.mode !== 'clear' ? DIRT : 1) * st.r;
const boxOf = (pts, R) => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } return { x0: x0 - R, z0: z0 - R, x1: x1 + R, z1: z1 + R }; };
const joinBox = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) });
const meets = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.z0 <= b.z1 && b.z0 <= a.z1;
const r2 = (v) => Math.round(v * 100) / 100;

// ── the grid and what lies under a stroke ────────────────────────────────────────────────────────────────────────────
export function gridOver(box, step = MERGE.step) {
  const x0 = Math.floor(box.x0 / step) * step, z0 = Math.floor(box.z0 / step) * step;
  const nx = Math.max(1, Math.ceil((box.x1 - x0) / step)), nz = Math.max(1, Math.ceil((box.z1 - z0) / step));
  return { x0, z0, nx, nz, n: nx * nz, s: step };
}
// the cells whose middles are within R of the line (a single point: a round dab), as a list (null: none). (One marks array
// kept for every call, each call its own stamp: a grid-sized array a stroke was most of the work)
let MARK = new Uint32Array(0), STAMP = 0;
function under(G, pts, R) {
  const b = boxOf(pts, R); if (b.x1 < G.x0 || b.z1 < G.z0 || b.x0 > G.x0 + G.nx * G.s || b.z0 > G.z0 + G.nz * G.s) return null;
  if (MARK.length < G.n) MARK = new Uint32Array(G.n);
  if (++STAMP > 0xfffffff0) { MARK.fill(0); STAMP = 1; }
  const m = MARK, id = STAMP, R2 = R * R, s = G.s, list = [];
  for (let k = 0; k < Math.max(1, pts.length - 1); k++) {
    const a = pts[k], c = pts[Math.min(k + 1, pts.length - 1)], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz, inv = L2 > 0 ? 1 / L2 : 0;
    const i0 = Math.max(0, Math.floor((Math.min(a[0], c[0]) - R - G.x0) / s)), i1 = Math.min(G.nx - 1, Math.floor((Math.max(a[0], c[0]) + R - G.x0) / s));
    const j0 = Math.max(0, Math.floor((Math.min(a[1], c[1]) - R - G.z0) / s)), j1 = Math.min(G.nz - 1, Math.floor((Math.max(a[1], c[1]) + R - G.z0) / s));
    for (let j = j0; j <= j1; j++) { const z = G.z0 + (j + 0.5) * s;
      for (let i = i0; i <= i1; i++) { const q = j * G.nx + i; if (m[q] === id) continue; const x = G.x0 + (i + 0.5) * s; let t = ((x - a[0]) * dx + (z - a[1]) * dz) * inv; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = a[0] + dx * t - x, ez = a[1] + dz * t - z; if (ex * ex + ez * ez <= R2) { m[q] = id; list.push(q); } } }
  }
  return list.length ? Int32Array.from(list) : null;
}

// ── the ground, part by part, on the grid ────────────────────────────────────────────────────────────────────────────
// ctx: { PLANT, SORT }; seen: a Map kept with the grid, of the cells under each stroke already worked out (or none).
// Returns { dirt, wild: { plant, tree, rock }, painted: Map(kind -> Float32Array thickness) }
export function groundOf(strokes, G, { PLANT, SORT = plantSorts(PLANT) }, seen = null) {
  const n = G.n, dirt = new Uint8Array(n), wild = { plant: new Uint8Array(n), tree: new Uint8Array(n), rock: new Uint8Array(n) }, painted = new Map();
  const cellsOf = (st) => { if (!(st && st.pts && st.pts.length && st.r > 0)) return null; if (seen && seen.has(st)) return seen.get(st); const m = under(G, st.pts, reachOf(st, PLANT)); if (seen) seen.set(st, m); return m; };
  const masks = strokes.map(cellsOf);
  strokes.forEach((st, i) => {
    const m = masks[i]; if (!m) return;
    // the dirt, in order: a footpath lays it, a rubbed-out one takes it away
    if (st.kind === PLANT.PATH && st.mode !== 'clear') { for (const c of m) dirt[c] = 1; }
    else if (st.kind === PLANT.NOPATH) { for (const c of m) dirt[c] = 0; }
    // what grows by itself kept back (world/objects/plantviews.js wildView): its own sort's strokes, and the Clears (a
    // rock's Clear: rocks only; a fence's: none)
    const cl = st.mode === 'clear' && !SORT.fence(st.kind);
    for (const sort of ['plant', 'tree', 'rock']) if ((cl && (sort === 'rock' || !SORT.rock(st.kind))) || SORT[sort](st.kind)) { const w = wild[sort]; for (const c of m) w[c] = 1; }
  });
  // the painted plants, from the last stroke back (world/objects/plantviews.js paintedView): each grows where no later Clear
  // went (a rock's Clear: rocks only; a fence's: none)
  const gone = new Uint8Array(n), goneRock = new Uint8Array(n);
  for (let i = strokes.length - 1; i >= 0; i--) {
    const st = strokes[i], m = masks[i]; if (!m) continue;
    if (st.mode === 'clear') { if (SORT.fence(st.kind)) continue; const rock = SORT.rock(st.kind); for (const c of m) { goneRock[c] = 1; if (!rock) gone[c] = 1; } continue; }
    if (!(st.density > 0) || !(SORT.plant(st.kind) || SORT.tree(st.kind) || SORT.rock(st.kind))) continue;
    const g = SORT.rock(st.kind) ? goneRock : gone; let L = painted.get(st.kind); if (!L) painted.set(st.kind, L = new Float32Array(n));
    for (const c of m) if (!g[c]) L[c] += st.density;
  }
  // (nothing grows by itself on the dirt: there the wild parts can't differ)
  for (const sort of ['plant', 'tree', 'rock']) { const w = wild[sort]; for (let c = 0; c < n; c++) if (dirt[c]) w[c] = 1; }
  return { dirt, wild, painted };
}

// how far (m) cell c is from the nearest cell where want(q) holds, looking no more than K cells away (Infinity: none so near):
// the cells round it looked at nearest first, so it stops at the first
const RINGS = new Map();
function rings(K) {
  let o = RINGS.get(K); if (o) return o;
  const L = []; for (let dj = -K; dj <= K; dj++) for (let di = -K; di <= K; di++) if (di * di + dj * dj <= K * K) L.push([di, dj, Math.sqrt(di * di + dj * dj)]);
  L.sort((a, b) => a[2] - b[2]); RINGS.set(K, o = L); return o;
}
function nearest(G, c, want, K) {
  const i = c % G.nx, j = (c / G.nx) | 0;
  for (const [di, dj, d] of rings(K)) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < G.nx && b < G.nz && want(b * G.nx + a)) return d * G.s; }
  return Infinity;
}
// the patches (8 ways round for what's on, 4 for what's off, so a diagonal touch joins dirt but not the grass between)
function patches(G, on, eight) {
  const { nx, nz } = G, lab = new Int32Array(G.n).fill(-1); let k = 0; const st = [];
  for (let c = 0; c < G.n; c++) { if (!on(c) || lab[c] >= 0) continue; lab[c] = k; st.push(c);
    while (st.length) { const q = st.pop(), i = q % nx, j = (q / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if ((!di && !dj) || (!eight && di && dj)) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const p = b * nx + a; if (on(p) && lab[p] < 0) { lab[p] = k; st.push(p); } } }
    k++; }
  return { lab, k };
}
// do the patches of A and of B pair off one for one (each one before overlaps just one after, and the other way)?
function samePatches(P, Q) {
  const a2b = new Map(), b2a = new Map();
  for (let c = 0; c < P.lab.length; c++) { const a = P.lab[c], b = Q.lab[c]; if (a < 0 || b < 0) continue;
    if (!a2b.has(a)) a2b.set(a, new Set()); a2b.get(a).add(b); if (!b2a.has(b)) b2a.set(b, new Set()); b2a.get(b).add(a); }
  if (a2b.size !== P.k || b2a.size !== Q.k) return false;
  for (const s of a2b.values()) if (s.size !== 1) return false;
  for (const s of b2a.values()) if (s.size !== 1) return false;
  return true;
}

// ── what differs, part by part ───────────────────────────────────────────────────────────────────────────────────────
// A: before, B: after (groundOf on the same grid). Returns { parts: [{ name, added, removed, thick (m2), far (m), taken,
// door (cells against the guard), at: [x, z] (the middle of what differs) }], paths (true: the same patches of dirt and
// of the ground between), area (m2 differing, any part) }. far is looked for out to `limit` m (past it: Infinity); stop:
// give up at the first cell past it (returns null)
export function differ(A, B, G, guard = null, limit = 5, stop = false) {
  const cell = G.s * G.s, parts = [], any = new Uint8Array(G.n), K = Math.ceil(limit / G.s) + 1;
  const xy = (c) => [G.x0 + ((c % G.nx) + 0.5) * G.s, G.z0 + (((c / G.nx) | 0) + 0.5) * G.s];
  const part = (name, a, b, paint) => {
    let added = 0, removed = 0, thick = 0, far = 0, taken = 0, door = 0, sx = 0, sz = 0, nd = 0;
    const was = (k) => (a ? a[k] : 0) > 0, wasNot = (k) => !was(k);
    for (let c = 0; c < G.n; c++) {
      const p = a ? a[c] : 0, q = b ? b[c] : 0; if (p === q) continue;
      let kind = 0;
      if (!(p > 0) && q > 0) kind = 1; else if (p > 0 && !(q > 0)) kind = 2; else if (Math.abs(p - q) > MERGE.thick * Math.max(p, q)) kind = 3; else continue;
      const [x, z] = xy(c); any[c] = 1; sx += x; sz += z; nd++;
      if (kind === 1) { added++; far = Math.max(far, nearest(G, c, was, K)); if (stop && far > limit) return false; if (paint && guard && guard.taken(x, z)) taken++; }
      else if (kind === 2) { removed++; far = Math.max(far, nearest(G, c, wasNot, K)); if (stop && far > limit) return false; if (guard && guard.door(x, z)) door++; }
      else { thick++; if (guard && guard.door(x, z) && q < p) door++; }
    }
    parts.push({ name, added: added * cell, removed: removed * cell, thick: thick * cell, far, taken, door, at: nd ? [r2(sx / nd), r2(sz / nd)] : null });
    return true;
  };
  if (!part('dirt', A.dirt, B.dirt, true)) return null;
  for (const k of new Set([...A.painted.keys(), ...B.painted.keys()])) if (!part('painted ' + k, A.painted.get(k), B.painted.get(k), true)) return null;
  for (const sort of ['plant', 'tree', 'rock']) if (!part('wild ' + sort, A.wild[sort], B.wild[sort], false)) return null;
  let paths = true;
  if (parts[0].added || parts[0].removed) {
    paths = samePatches(patches(G, (c) => A.dirt[c], true), patches(G, (c) => B.dirt[c], true)) && samePatches(patches(G, (c) => !A.dirt[c], false), patches(G, (c) => !B.dirt[c], false));
  }
  let area = 0; for (let c = 0; c < G.n; c++) area += any[c];
  return { parts, paths, area: area * cell };
}

// ── the guard: where no new paint may go, and what may not be taken from in front of a door ─────────────────────────
export function makeGuard({ rects = [], spots = [], doors = [], inside = null } = {}) {
  const R = rects.map((b) => ({ x: b.x, z: b.z, c: Math.cos(b.rot || 0), s: Math.sin(b.rot || 0), hw: b.w / 2, hd: b.d / 2, far: Math.hypot(b.w, b.d) / 2 }));
  const D = doors.map((d) => { const L = Math.hypot(d.ox, d.oz) || 1; return { x: d.x, z: d.z, ox: d.ox / L, oz: d.oz / L, half: d.half || 0.5 }; });
  const door = (x, z) => D.some((d) => { const px = x - d.x, pz = z - d.z, al = px * d.ox + pz * d.oz, lat = Math.abs(px * d.oz - pz * d.ox); return al > -DOOR.back && al < DOOR.out && lat < d.half + DOOR.side; });
  const taken = (x, z) => {
    for (const b of R) { const x1 = x - b.x, z1 = z - b.z; if (Math.abs(x1) > b.far || Math.abs(z1) > b.far) continue; if (Math.abs(b.c * x1 - b.s * z1) < b.hw && Math.abs(b.s * x1 + b.c * z1) < b.hd) return true; }
    for (const p of spots) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return true;
    return door(x, z) || !!(inside && inside(x, z));
  };
  return { taken, door };
}

// ── new shapes for a few strokes ─────────────────────────────────────────────────────────────────────────────────────
// a line with the points left out wherever leaving them out moves it by less than tol (Douglas-Peucker: running it again
// leaves it as it is)
export function simplifyLine(pts, tol) {
  const n = pts.length; if (n < 3) return pts.map((p) => [p[0], p[1]]);
  const keep = new Uint8Array(n), stack = [0, n - 1], t2 = tol * tol; keep[0] = keep[n - 1] = 1;
  while (stack.length) {
    const b = stack.pop(), a = stack.pop(), A = pts[a], B = pts[b], dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz; let far = -1, worst = t2;
    for (let k = a + 1; k < b; k++) { let t = L2 > 0 ? ((pts[k][0] - A[0]) * dx + (pts[k][1] - A[1]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = A[0] + dx * t - pts[k][0], ez = A[1] + dz * t - pts[k][1], d = ex * ex + ez * ez; if (d > worst) { worst = d; far = k; } }
    if (far >= 0) { keep[far] = 1; stack.push(a, far, far, b); }
  }
  return pts.filter((_, k) => keep[k]).map((p) => [p[0], p[1]]);
}
export const edgeFor = (R) => Math.min(MERGE.edgeMost, Math.max(MERGE.edge, MERGE.edgeShare * R));   // (how far out what differs may be, for a brush reaching R)
const tolFor = (R) => Math.min(MERGE.tolMost, Math.max(0.02, MERGE.tol * R));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the nearest spot on a line to p: { k (the run it's on), q (the spot), d }
function nearestOn(pts, p) {
  let best = { k: 0, q: pts[0], d: dist(pts[0], p) };
  for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; let t = L2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const q = [a[0] + dx * t, a[1] + dz * t], d = dist(q, p); if (d < best.d) best = { k, q, d }; }
  return best;
}
// two lines made one: B's near end joined on at A's end (A or B turned round, whichever joins shortest); one running on
// into the other (A, then B from its spot nearest A's end: where they overlap, the one line goes on as the other); or B
// hung off the spot on A nearest it, there and back (a branch: the brush goes down it and back the same way). Only joins
// whose new stretch is no longer than `jump` (longer, and it would cross ground neither stroke had)
function joins(A, B, jump = Infinity) {
  const out = [], rev = (p) => [...p].reverse();
  const ends = [[A, B], [A, rev(B)], [rev(A), B], [rev(A), rev(B)]].map(([a, b]) => ({ pts: [...a, ...b], gap: dist(a[a.length - 1], b[0]) }));
  ends.sort((x, y) => x.gap - y.gap); if (ends[0].gap <= jump) out.push(ends[0].pts);
  for (const [a, b] of [[A, B], [B, A]]) for (const a1 of [a, rev(a)]) for (const b1 of [b, rev(b)]) {
    if (b1.length < 2) continue;
    const n = nearestOn(b1, a1[a1.length - 1]); if (n.d <= jump && n.k + 1 < b1.length) out.push([...a1, n.q, ...b1.slice(n.k + 1)]);
  }
  for (const [a, b] of [[A, B], [B, A]]) {
    if (a.length < 2) continue;
    const n0 = nearestOn(a, b[0]), n1 = nearestOn(a, b[b.length - 1]), near = n0.d <= n1.d ? n0 : n1, br = n0.d <= n1.d ? b : rev(b);
    if (near.d <= jump) out.push([...a.slice(0, near.k + 1), near.q, ...br, ...rev(br), near.q, ...a.slice(near.k + 1)]);
  }
  return out;
}
// a line cut back by `back` m at its start (end: at its end), never past half its length
function cutBack(pts, back, end) {
  const p = end ? [...pts].reverse() : pts.map((q) => q); let len = 0; for (let k = 1; k < p.length; k++) len += dist(p[k - 1], p[k]);
  let left = Math.min(back, len / 2);
  while (left > 0 && p.length > 2 && dist(p[0], p[1]) <= left) { left -= dist(p[0], p[1]); p.shift(); }
  if (left > 0 && p.length >= 2) { const l = dist(p[0], p[1]) || 1, t = Math.min(1, left / l); p[0] = [p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t]; }
  return end ? p.reverse() : p;
}
// one wide stroke over the strokes' ground: along a guide line through them, the middle of the ground across it at each
// step and how far it reaches either side. R: how wide (the widest reach, or a little less); its ends drawn in so the
// brush's round end comes out about where the ground ended (all the way, or half: a wide round end can't fill the corners
// of narrow ones side by side, so it either cuts them or overshoots between them)
function wide(G, mask, line, R0) {
  const L = []; for (let k = 0; k < line.length - 1; k++) { const a = line[k], b = line[k + 1], d = dist(a, b), n = Math.max(1, Math.ceil(d / Math.max(0.5, R0 / 2))); for (let t = 0; t < n; t++) L.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
  L.push(line[line.length - 1]);
  if (L.length < 2) return [];
  const inside = (x, z) => { const i = Math.floor((x - G.x0) / G.s), j = Math.floor((z - G.z0) / G.s); return i >= 0 && j >= 0 && i < G.nx && j < G.nz && mask[j * G.nx + i] === 1; };
  const reach = (p, ux, uz) => { let d = 0; while (d < R0 * 4 && inside(p[0] + ux * (d + G.s / 2), p[1] + uz * (d + G.s / 2))) d += G.s / 2; return d; };
  const mid = [], w = [];
  for (let k = 0; k < L.length; k++) {
    const a = L[Math.max(0, k - 1)], b = L[Math.min(L.length - 1, k + 1)], l = dist(a, b) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l, nx = -tz, nz = tx, p = L[k];
    if (!inside(p[0], p[1])) continue;
    const up = reach(p, nx, nz), down = reach(p, -nx, -nz);
    mid.push([p[0] + nx * (up - down) / 2, p[1] + nz * (up - down) / 2]); w.push((up + down) / 2);
  }
  if (mid.length < 2) return [];
  // (smoothed a little, so the line doesn't wobble with the cells)
  const sm = mid.map((p, k) => k === 0 || k === mid.length - 1 ? p : [(mid[k - 1][0] + 2 * p[0] + mid[k + 1][0]) / 4, (mid[k - 1][1] + 2 * p[1] + mid[k + 1][1]) / 4]);
  const ws = [...w].sort((a, b) => a - b), out = [];
  const endRoom = (k, j) => { const p = sm[k], o = sm[j], l = dist(p, o) || 1; return reach(p, (p[0] - o[0]) / l, (p[1] - o[1]) / l); };
  const e0 = endRoom(0, 1), e1 = endRoom(sm.length - 1, sm.length - 2);
  for (const q of [1, 0.9]) {
    const R = ws[Math.min(ws.length - 1, Math.floor(q * (ws.length - 1)))]; if (!(R > 0)) continue;
    for (const share of [0.5, 1]) out.push({ pts: cutBack(cutBack(sm, Math.max(0, R - e0) * share, false), Math.max(0, R - e1) * share, true), R });
  }
  return out;
}

// ── the merge ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function mergeStrokes(planting, { PLANT, keep = new Set(), guard = null, step = MERGE.step } = {}) {
  const SORT = plantSorts(PLANT), ctx = { PLANT, SORT }, orig = planting.strokes;
  const from = new Map(orig.map((s) => [s, [s]]));   // (each stroke now: the strokes as they were that it stands for)
  const keyOf = (st) => (keep.has(st.id) ? null : mergeKey(st, PLANT, SORT));
  const reach = (st) => reachOf(st, PLANT), reachBox = (st) => boxOf(st.pts, reach(st));
  const fenceBefore = fencesStanding(orig, PLANT), merged = [];
  let strokes = [...orig], tries = 0;
  // the ground round some strokes as it was, once: the grid over them (and room round them for a wider stroke and its
  // edges; a coarser grid over a very big stroke). `base`: the area what differs is a share of: the ground the strokes
  // add to the biggest of them (so a big stroke can't swallow a small one and change it out of all knowing), or one
  // stroke's own. against: the strokes it is measured from (as they were before the merge began, unless said)
  const region = (was, wider = 0, against = orig) => {
    const R = Math.max(...was.map(reach)); let box = null; for (const s of was) box = joinBox(box, reachBox(s));
    const m = edgeFor(R) + wider + 1, B = { x0: box.x0 - m, z0: box.z0 - m, x1: box.x1 + m, z1: box.z1 + m };
    const G = gridOver(B, Math.max(step, Math.sqrt((B.x1 - B.x0) * (B.z1 - B.z0) / MERGE.cells)));
    const own = new Uint8Array(G.n); let most = 0;
    for (const s of was) { const u = under(G, s.pts, reach(s)); if (u) { for (const c of u) own[c] = 1; most = Math.max(most, u.length); } }
    let all = 0; for (let c = 0; c < G.n; c++) all += own[c];
    const seen = new Map();
    return { G, seen, A: groundOf(against, G, ctx, seen), own, base: (was.length > 1 ? all - most : all) * G.s * G.s, fence: was.some((s) => SORT.fence(s.kind)) };
  };
  // is the ground with the strokes `next` close enough to how it was? (R: the widest brush in it; loose: a share of the
  // usual allowance) -> what differs, or null
  const judge = (Z, next, R, loose = 1) => {
    tries++;
    if (Z.fence) return fencesStanding(next, PLANT) === fenceBefore ? { area: 0, parts: [], paths: true } : null;
    const edge = edgeFor(R) * loose, d = differ(Z.A, groundOf(next, Z.G, ctx, Z.seen), Z.G, guard, edge + Z.G.s * 0.75, true);
    if (!d || !d.paths) return null;
    for (const p of d.parts) if (p.taken || p.door || p.far > edge + Z.G.s * 0.75 || p.added + p.removed + p.thick > MERGE.share * loose * Z.base + 1e-9) return null;
    return d;
  };
  // do two strokes' grounds meet? (their lines come within the two reaches)
  const touch = (a, b) => { const R = reach(a) + reach(b), h = Math.max(0.25, Math.min(reach(a), reach(b)) / 2);
    for (let k = 0; k < Math.max(1, a.pts.length - 1); k++) { const p = a.pts[k], q = a.pts[Math.min(k + 1, a.pts.length - 1)], n = Math.max(1, Math.ceil(dist(p, q) / h));
      for (let t = 0; t <= n; t++) { const x = [p[0] + (q[0] - p[0]) * t / n, p[1] + (q[1] - p[1]) * t / n]; if ((b.pts.length > 1 ? nearestOn(b.pts, x).d : dist(b.pts[0], x)) <= R) return true; } }
    return false; };
  // the strokes as they would be with A and B gone and `made` at the place in the order of `at` (null: just gone)
  const without = (gone, made, at) => { const next = strokes.filter((s) => !gone.includes(s)); if (made) next.splice(strokes.slice(0, strokes.indexOf(at)).filter((s) => !gone.includes(s)).length, 0, made); return next; };
  // the best change for two strokes: one left out (all but a sliver of it under the other), else the two joined (each
  // shape tried at either one's place in the order); the closest that passes -> { gone, made, at, R, d } | null
  const best = (A, B) => {
    const R0 = Math.max(reach(A), reach(B)), Z = region([...from.get(A), ...from.get(B)], R0);
    let out = null;
    // (the closest, each point of the new line counted as MERGE.point m2 more: a simpler line wins when it's about as close)
    const score = (c) => c.d.area + MERGE.point * (c.made ? c.made.pts.length : 0), take = (c) => { if (c.d && (!out || score(c) < score(out) - 1e-9)) out = c; };
    for (const [x, y] of [[A, B], [B, A]]) take({ gone: [x], made: null, at: null, R: reach(y), d: judge(Z, without([x]), reach(y)) });
    if (out) return out;
    const first = strokes.indexOf(A) < strokes.indexOf(B) ? A : B, k = reach(first) / first.r, shapes = [], seen = new Set();
    const add = (pts, r) => { if (!(r > 0)) return; const p = simplifyLine(pts, tolFor(r * k)).map((q) => [r2(q[0]), r2(q[1])]), key = r + JSON.stringify(p); if (!seen.has(key)) { seen.add(key); shapes.push({ pts: p, r }); } };
    for (const pts of joins(A.pts, B.pts, reach(A) + reach(B))) for (const r of new Set([A.r, B.r])) add(pts, r);
    // (one wide stroke over the two strokes' own ground, along either one's line)
    for (const guide of [A.pts, B.pts]) if (guide.length > 1) for (const w of wide(Z.G, Z.own, guide, R0)) add(w.pts, Math.round(w.R / k * 1000) / 1000);
    // (the place in the order matters only if a stroke between the two reaches their ground)
    const [i0, i1] = [strokes.indexOf(A), strokes.indexOf(B)].sort((a, b) => a - b), box = joinBox(reachBox(A), reachBox(B));
    const places = strokes.slice(i0 + 1, i1).some((s) => meets(reachBox(s), { x0: box.x0 - R0, z0: box.z0 - R0, x1: box.x1 + R0, z1: box.z1 + R0 })) ? [A, B] : [first];
    for (const sh of shapes) {
      const made = { ...first, r: sh.r, pts: sh.pts };
      const R = Math.max(R0, sh.r * k);
      for (const at of places) take({ gone: [A, B], made, at, R, d: judge(Z, without([A, B], made, at), R) });
    }
    return out;
  };
  // two at a time, the closest change first, again until nothing more joins. Each pair's best is kept until a change is made
  // near it (then it is worked out again), and checked again just before it is made, measured just as it was found
  const cache = new Map(), pairKey = (a, b) => a.id + '|' + b.id, near = (s) => { const b = reachBox(s), R = reach(s); return { x0: b.x0 - R, z0: b.z0 - R, x1: b.x1 + R, z1: b.z1 + R }; };
  for (let again = true; again;) {
    again = false;
    const live = strokes.filter((s) => keyOf(s)), cand = [];
    for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
      const A = live[a], B = live[b]; if (keyOf(A) !== keyOf(B) || !meets(reachBox(A), reachBox(B))) continue;
      const key = pairKey(A, B); let c = cache.get(key);
      if (c === undefined || c.A !== A || c.B !== B) { c = { A, B, box: joinBox(near(A), near(B)), ...((touch(A, B) && best(A, B)) || { d: null }) }; cache.set(key, c); }
      if (c.d) cand.push(c);
    }
    cand.sort((x, y) => x.d.area - y.d.area);   // (the pair whose change leaves the ground nearest as it was, first)
    for (const c of cand) {
      // (again with the strokes as they are now: one that no longer passes is worked out afresh next time round)
      const next = without(c.gone, c.made, c.at), d = judge(region([...from.get(c.A), ...from.get(c.B)], Math.max(reach(c.A), reach(c.B))), next, c.R);
      if (!d) { cache.delete(pairKey(c.A, c.B)); again = true; continue; }
      const was = [...from.get(c.A), ...from.get(c.B)], stay = c.made || (c.gone[0] === c.A ? c.B : c.A);
      from.set(stay, was); merged.push({ from: was, to: c.made, what: c.made ? 'join' : 'drop', d });
      // (the pairs near what changed are worked out again)
      let box = null; for (const s of [c.A, c.B, ...(c.made ? [c.made] : [])]) box = joinBox(box, near(s));
      for (const [k, e] of cache) if (meets(e.box, box)) cache.delete(k);
      strokes = next; again = true; break;
    }
  }
  // each stroke's own line with the points it doesn't need left out: the line moves by tol at most, so measured from the
  // strokes just before it (it settles in one go: a second Save finds nothing more)
  for (let i = 0; i < strokes.length; i++) {
    const st = strokes[i]; if (!keyOf(st) || st.pts.length < 3) continue;
    const pts = simplifyLine(st.pts, tolFor(reach(st))); if (pts.length >= st.pts.length) continue;
    const made = { ...st, pts }, next = [...strokes]; next[i] = made;
    const d = judge(region([st], 0, strokes), next, reach(st), 0.5); if (!d) continue;
    from.set(made, from.get(st)); merged.push({ from: from.get(st), to: made, what: 'points', d });
    strokes = next;
  }
  // (each stroke now standing for several as they were)
  const groups = strokes.filter((s) => from.has(s) && from.get(s).length > 1).map((s) => ({ to: s, from: from.get(s) }));
  return { strokes, merged, groups, tries };
}
