// THE BEVEL HELPER: the chamfered look the game's maker asked for (2026-11-09: "If all the objects had bevels and
// negative bevels on their surfaces with rectangular octagons I think that will really help the style"). Everything
// here grows from one shape, the chamfered rectangle (his "rectangular octagon"), and comes out as an indexed
// BufferGeometry with position, normal and uv (uv in metres, as kit/geo.js), every facet with its own flat normal, so the
// bevels read crisp, as the ships' faceted hulls do.
//
// THE SHAPE  { w, h, c, x, y, open }
//   w, h    its width (x) and height (y), metres
//   c       the corner chamfer: one number for every corner, [bottom, top], or [bottom-left, bottom-right, top-right,
//           top-left]; 0 is a square corner. A chamfer is cut at 45 degrees, c along each side.
//   x, y    its middle (0, 0)
//   open    'bottom': the bottom side left open (a doorway's frame runs down to the floor): the rings step in from the
//           sides and the top only, and every one of them runs down to the shape's bottom
//   shape(w, h, c, x, y, open) makes one; octagon(s) gives its 8 corners, counter-clockwise from the bottom-left one's
//   bottom end; inset(s, d) is the same shape d in from every side (each side parallel to its own, so every facet of a
//   bevel comes out the same width: a chamfer shrinks by d (2 - sqrt 2))
//
// RELIEF ON A FACE: relief(shape, rings, opts) -> the shape on the z = 0 plane, facing +z, with RINGS stepping in from its
// outline. Each ring, from the outline in:
//   inset   how far in from where the ring before it ended (from the outline, for the first) its slope starts: the
//           width of the flat before it
//   depth   the level its slope takes it to, from the face: + stands out of the face, - sinks into it
//   bevel   how wide its slope is, across (0: a sheer step)
// After the last ring the middle is a flat field at that ring's depth (or left open: opts.hole). Ready-made rings:
//   RINGS.bevel(d, b)          a raised plateau with a bevelled edge: d out, the slope b wide
//   RINGS.sunk(d, b)           a recess with bevelled walls (a negative bevel): d in
//   RINGS.border(w, d, b, r)   a border bevel: a flat border w wide, raised r out of the face, round a field sunk d into
//                              it (its slope b wide)
//   RINGS.steps(n, w, d, b)    n nested rings each w wide stepping d further in (a negative stepped frame)
//   any list of your own: nested rings, each with its own inset, depth and bevel (the doorway's frame is three)
//   opts: base (the outline's own level, 0); hole (no field: a frame round an opening); jamb (with a hole: the opening's
//         sides carried straight back from the last ring to this level); open (as the shape's)
//
// SOLIDS (furniture blocks: table tops, stools, cabinet bodies, bench bases)
//   solid(shape, depth, opts)   the outline pushed out along +z from 0 to depth, with a chamfer round both faces:
//     edge   (0.01) the 45-degree chamfer round its front and back faces (0: sharp)
//     front  rings: a relief on its front face, starting at the chamfer's inner edge (any of RINGS)
//     back   false: no back face (a block against a wall)
//     taper  another shape for its back (a block narrowing toward its foot)
//   loft(sections, opts)        a faceted column through octagons, sections [{ s, z }] in order along +z (a pedestal, a
//                               stool's waist); opts.start / opts.end: false leaves the first / last end open
//   prism(points, z0, z1, opts) any polygon ([x, y] points) from z0 to z1, flat faces, sheer sides (a door leaf with
//                               a stepped seam): opts.holes (outlines cut from both faces, where a relief goes),
//                               opts.front / back / sides false leave that part out
//   plate(shape, z)             a flat octagon facing +z (a light strip, a screen, a sign's face)
//
// TRIANGLES (each facet a quad of 2; a square corner's facets drop out)
//   a ring: its slope 16 and the flat before it 16 (8 and 8 with square corners); the field 6
//   RINGS.bevel / RINGS.sunk 22, RINGS.border 54, each nested ring 32 more
//   solid 60 (54 with no back); its front relief adds the relief's own and drops the plain front's 6
//   loft 16 a step between two sections, 6 an end; prism 2 a side, its faces what their outline needs; plate 6
// Everything stands on z = 0 facing +z: kit/geo.js's put(g, at, rot) turns it onto any face.
import * as THREE from 'three';
import { put } from './geo.js';

const K = 2 - Math.SQRT2, EPS = 1e-9;
const corners = (c = 0) => (Array.isArray(c) ? (c.length === 2 ? [c[0], c[0], c[1], c[1]] : c.slice(0, 4)) : [c, c, c, c]);
const norm = (s) => ({ w: s.w, h: s.h, c: corners(s.c), x: s.x ?? 0, y: s.y ?? 0, open: s.open || null });

export function shape(w, h, c = 0, x = 0, y = 0, open = null) { return { w, h, c: corners(c), x, y, open }; }
// the 8 corners, counter-clockwise: bottom side first (edge 0), then the bottom-right chamfer, the right side, ...
export function octagon(s0) {
  const s = norm(s0), hw = s.w / 2, hh = s.h / 2, m = Math.min(hw, hh), [a, b, c, d] = s.c.map((v) => Math.max(0, Math.min(v, m))), { x, y } = s;
  return [[x - hw + a, y - hh], [x + hw - b, y - hh], [x + hw, y - hh + b], [x + hw, y + hh - c], [x + hw - c, y + hh], [x - hw + d, y + hh], [x - hw, y + hh - d], [x - hw, y - hh + a]];
}
export function inset(s0, d) {
  const s = norm(s0), top = (v) => Math.max(0, v - d * K);
  // (an open bottom stays on its line: the sides come in, the top comes down, and a bottom chamfer, met by a side that
  // has moved in, grows by d (sqrt 2 - 1) so its facet keeps the ring's width)
  if (s.open === 'bottom') return { ...s, w: Math.max(1e-4, s.w - 2 * d), h: Math.max(1e-4, s.h - d), y: s.y - d / 2, c: [s.c[0] > 0 ? s.c[0] + d * (Math.SQRT2 - 1) : 0, s.c[1] > 0 ? s.c[1] + d * (Math.SQRT2 - 1) : 0, top(s.c[2]), top(s.c[3])] };
  return { ...s, w: Math.max(1e-4, s.w - 2 * d), h: Math.max(1e-4, s.h - 2 * d), c: s.c.map(top) };
}

export const RINGS = {
  bevel: (d = 0.01, b = d) => [{ inset: 0, depth: d, bevel: b }],
  sunk: (d = 0.01, b = d) => [{ inset: 0, depth: -d, bevel: b }],
  border: (w = 0.04, d = 0.006, b = d * 1.5, r = 0.003) => [{ inset: 0, depth: r, bevel: r }, { inset: w, depth: -d, bevel: b }],
  steps: (n = 3, w = 0.02, d = 0.008, b = w * 0.4) => Array.from({ length: n }, (_, i) => ({ inset: i ? w - b : 0, depth: -d * (i + 1), bevel: b })),
};

// ── the drawing: flat facets, each with its own vertices and normal ──
class Out {
  constructor() { this.p = []; this.n = []; this.uv = []; this.ix = []; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.ix); return g;
  }
}
const area2 = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); };
// a flat convex facet, its points [x, y, z] counter-clockwise seen from the side it faces (a fan from the first point;
// slivers left out)
function facet(o, pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1, z1] = pts[i], [x2, y2, z2] = pts[(i + 1) % pts.length]; nx += (y1 - y2) * (z1 + z2); ny += (z1 - z2) * (x1 + x2); nz += (x1 - x2) * (y1 + y2); }
  const l = Math.hypot(nx, ny, nz); if (l < 1e-10) return;
  nx /= l; ny /= l; nz /= l;
  // (uv in metres: x, y on a facet that looks along z; else along its longest edge and up z)
  let ex = 1, ey = 0;
  if (Math.abs(nz) < 0.5) { let best = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); if (d > best) { best = d; ex = dx / d; ey = dy / d; } } }
  const base = o.p.length / 3;
  for (const [x, y, z] of pts) { o.p.push(x, y, z); o.n.push(nx, ny, nz); if (Math.abs(nz) >= 0.5) o.uv.push(x, y); else o.uv.push(x * ex + y * ey, z); }
  for (let i = 1; i < pts.length - 1; i++) if (area2(pts[0], pts[i], pts[i + 1]) > 1e-10) o.ix.push(base, base + i, base + i + 1);
}
const same = (A, B) => Math.abs(A.z - B.z) < EPS && A.pts.every((p, i) => Math.abs(p[0] - B.pts[i][0]) < EPS && Math.abs(p[1] - B.pts[i][1]) < EPS);
// consecutive loops ({ pts, z }) joined side by side: loop A to loop B, each side's quad A[i] A[i+1] B[i+1] B[i] (an
// outer loop before an inner one on a face, a back loop before a front one round a solid: each faces out)
function join(o, L, skip) {
  for (let k = 0; k < L.length - 1; k++) {
    const A = L[k], B = L[k + 1], N = A.pts.length; if (same(A, B)) continue;
    for (let i = 0; i < N; i++) { if (skip && skip(i)) continue; const j = (i + 1) % N; facet(o, [[...A.pts[i], A.z], [...A.pts[j], A.z], [...B.pts[j], B.z], [...B.pts[i], B.z]]); }
  }
}
function cap(o, L, up) { const pts = L.pts.map(([x, y]) => [x, y, L.z]); facet(o, up ? pts : pts.reverse()); }
// the loops a list of rings makes, from shape s at level base (pushed onto L)
function ringLoops(L, s, rings, base) {
  let d = 0, z = base;
  for (const r of rings) {
    if ((r.inset ?? 0) > 1e-6) { d += r.inset; L.push({ pts: octagon(inset(s, d)), z }); }
    d += r.bevel ?? 0; z = base + (r.depth ?? 0); L.push({ pts: octagon(inset(s, d)), z });
  }
  return L;
}

export function relief(s0, rings = [], opts = {}) {
  const s = { ...norm(s0), open: opts.open ?? norm(s0).open }, base = opts.base ?? 0, o = new Out();
  const L = ringLoops([{ pts: octagon(s), z: base }], s, rings, base);
  if (opts.hole && opts.jamb != null) L.push({ pts: L[L.length - 1].pts, z: opts.jamb });
  join(o, L, s.open === 'bottom' ? (i) => i === 0 : null);
  if (!opts.hole) cap(o, L[L.length - 1], true);
  return o.geometry();
}

export function solid(s0, depth, opts = {}) {
  const s = norm(s0), back = opts.taper ? norm(opts.taper) : s, m = Math.min(s.w, s.h, back.w, back.h) / 2;
  const e = Math.max(0, Math.min(opts.edge ?? 0.01, depth / 2 - 1e-5, m * 0.9)), o = new Out(), L = [], hasBack = opts.back !== false;
  if (hasBack) L.push({ pts: octagon(inset(back, e)), z: 0 });
  L.push({ pts: octagon(back), z: hasBack ? e : 0 }, { pts: octagon(s), z: depth - e });
  const front = inset(s, e); L.push({ pts: octagon(front), z: depth });
  ringLoops(L, front, opts.front || [], depth);
  join(o, L);
  if (hasBack) cap(o, L[0], false);
  cap(o, L[L.length - 1], true);
  return o.geometry();
}

export function loft(sections, opts = {}) {
  const o = new Out(), L = sections.map(({ s, z }) => ({ pts: octagon(s), z }));
  join(o, L);
  if (opts.start !== false) cap(o, L[0], false);
  if (opts.end !== false) cap(o, L[L.length - 1], true);
  return o.geometry();
}

// (consecutive repeats dropped: a square corner's two points are one)
const clean = (pts) => pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.abs(p[0] - q[0]) > 1e-7 || Math.abs(p[1] - q[1]) > 1e-7; });
const signed = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
export function prism(points, z0, z1, opts = {}) {
  let pts = clean(points); if (signed(pts) < 0) pts = pts.slice().reverse();
  const holes = (opts.holes || []).map((h) => { const c = clean(h); return signed(c) > 0 ? c.slice().reverse() : c; }), o = new Out();
  if (opts.sides !== false) join(o, [{ pts, z: z0 }, { pts, z: z1 }]);
  const tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, y]) => new THREE.Vector2(x, y)), holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y))));
  const all = [...pts, ...holes.flat()];
  for (const [face, z, nz] of [['front', z1, 1], ['back', z0, -1]]) {
    if (opts[face] === false) continue;
    const base = o.p.length / 3;
    for (const [x, y] of all) { o.p.push(x, y, z); o.n.push(0, 0, nz); o.uv.push(x, y); }
    for (const [a, b, c] of tris) {
      const A = all[a], B = all[b], C = all[c], s = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(s) < 1e-12) continue;
      if (s * nz > 0) o.ix.push(base + a, base + b, base + c); else o.ix.push(base + a, base + c, base + b);
    }
  }
  return o.geometry();
}

export function plate(s, z = 0) { const o = new Out(); cap(o, { pts: octagon(s), z }, true); return o.geometry(); }

// a part of a piece: geometry g turned by rot and moved to at (kit/geo.js put), added to piece p as `mat` ('solid' with
// a surface, 'glow' with a glow, 'decal' with a tint...)
export function add(p, look, g, at, rot, mat = 'solid') { put(g, at || [0, 0, 0], rot || [0, 0, 0]); return p.add(mat, g, look); }
// how many triangles a geometry has
export const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
