// FLAT FACETS for the ship's hull pieces (hull.js): a convex flat polygon, painted, with its back face, its seams, a
// stripe across it, or made a window (dark glass in a frame); and the frames and linings round holes in it.
// All in metres, in a piece's own frame. Each facet faces `out` (its corners may come in either order round).
//   Acc         collects a piece's triangles per surface, so a piece adds one geometry per paint (one draw for all)
//   facet(acc, pts, out, look, opts)   look: { paint, stripe, seams ('left' | 'all' | null), glass, inner }
//   ringFrame(acc, outer, inner, n, lift, depth, surf)   a raised frame between two loops (round a window or a door)
//   lining(acc, loop, n, depth, surf)  the sides of a hole through the hull: from the outer face `depth` inward
import * as THREE from 'three';
import { MeshData } from '../../geo.js';
import { SHIP } from '../palette.js';

export const THICK = 0.06;     // the hull plate: its inside face this far in
export const STEP = 0.6;       // the longest edge of a triangle (the bake lights each corner)
const SEAM_W = 0.022, SEAM_UP = 0.003, FRAME_W = 0.05;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// the normal of a polygon (Newell's), not normalised
function newell(pts) {
  const n = v(0, 0, 0);
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
  return n;
}
// the corners in order, repeats dropped, turned so they run counter-clockwise seen from `out`; and the unit normal
export function orient(pts, out) {
  const q = []; for (const p of pts) if (!q.length || q[q.length - 1].distanceTo(p) > 1e-6) q.push(p);
  while (q.length > 1 && q[0].distanceTo(q[q.length - 1]) < 1e-6) q.pop();
  const n = newell(q); if (n.lengthSq() < 1e-12) return null;
  n.normalize(); if (out && n.dot(out) < 0) { q.reverse(); n.negate(); }
  return { pts: q, n };
}
// the direction across a facet that a stripe's bands follow: up the facet, or (a level facet) along its frame's z
export function riseOf(n) {
  const r = v(0, 1, 0).addScaledVector(n, -n.y);
  if (r.lengthSq() < 0.04) r.set(0, 0, 1).addScaledVector(n, -n.z);
  return r.normalize();
}
// a convex polygon cut by a plane (keep where dot(p, axis) >= c, or <= c when below)
function clip(pts, axis, c, below) {
  const out = [], f = (p) => (below ? c - p.dot(axis) : p.dot(axis) - c);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) out.push(a.clone().lerp(b, fa / (fa - fb)));
  }
  return out;
}
// a convex polygon moved in from every edge by d (in its own plane), counter-clockwise seen from n
export function inset(pts, n, d) {
  const L = pts.length, out = [];
  for (let i = 0; i < L; i++) {
    const p0 = pts[(i - 1 + L) % L], p1 = pts[i], p2 = pts[(i + 1) % L];
    const e0 = p1.clone().sub(p0).normalize(), e1 = p2.clone().sub(p1).normalize();
    const in0 = n.clone().cross(e0), in1 = n.clone().cross(e1);   // (inward, for counter-clockwise)
    // where the two moved edges meet: p1 + in0 d + e0 s = p1 + in1 d + e1 t
    const bis = in0.clone().add(in1), c = bis.dot(in1);
    out.push(Math.abs(c) < 1e-6 ? p1.clone().addScaledVector(in1, d) : p1.clone().addScaledVector(bis, d / c));
  }
  return out;
}

// ── collecting a piece's triangles, per surface ──
export class Acc {
  constructor() { this.by = new Map(); }
  mesh(surf, mat = 'solid') { const k = mat === 'solid' ? surf : mat + ':' + (Array.isArray(surf) ? surf.join() : surf); let e = this.by.get(k); if (!e) this.by.set(k, (e = { m: new MeshData(), surf, mat })); return e.m; }
  // a convex polygon (counter-clockwise seen from n), split into triangles no longer than STEP
  poly(pts, n, surf, mat = 'solid', step = STEP) {
    if (pts.length < 3) return;
    const m = this.mesh(surf, mat), r = riseOf(n), t = n.clone().cross(r);
    const vert = (P) => m.v(P.x, P.y, P.z, n.x, n.y, n.z, P.dot(t), P.dot(r));
    const tri = (a, b, c) => { const ab = m.p, A = v(ab[a * 3], ab[a * 3 + 1], ab[a * 3 + 2]), B = v(ab[b * 3], ab[b * 3 + 1], ab[b * 3 + 2]), C = v(ab[c * 3], ab[c * 3 + 1], ab[c * 3 + 2]); if (B.sub(A).cross(C.sub(A)).dot(n) < 0) m.ix.push(a, c, b); else m.ix.push(a, b, c); };
    if (pts.length === 4) {
      const [a, b, c, d] = pts, nu = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), d.distanceTo(c)) / step)), nv = Math.max(1, Math.ceil(Math.max(a.distanceTo(d), b.distanceTo(c)) / step)), base = m.count;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, w = j / nv; vert(a.clone().lerp(b, u).lerp(d.clone().lerp(c, u), w)); }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const q = base + j * (nu + 1) + i; tri(q, q + 1, q + nu + 2); tri(q, q + nu + 2, q + nu + 1); }
      return;
    }
    // any other shape: small enough, a fan; bigger, cut by a square grid (STEP apart, in its own plane) into convex
    // bits, each a fan
    const span = Math.max(...pts.map((q) => Math.max(...pts.map((w) => q.distanceTo(w)))));
    if (span <= step * 1.5) { const i0 = m.count; for (const q of pts) vert(q); for (let i = 1; i < pts.length - 1; i++) tri(i0, i0 + i, i0 + i + 1); return; }
    const us = pts.map((q) => q.dot(t)), vs = pts.map((q) => q.dot(r)), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
    const nu = Math.ceil((u1 - u0) / step), nv = Math.ceil((v1 - v0) / step);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      let c = clip(pts, t, u0 + (u1 - u0) * i / nu, false); c = clip(c, t, u0 + (u1 - u0) * (i + 1) / nu, true);
      c = clip(c, r, v0 + (v1 - v0) * j / nv, false); c = clip(c, r, v0 + (v1 - v0) * (j + 1) / nv, true);
      const q = []; for (const P of c) if (!q.length || q[q.length - 1].distanceTo(P) > 1e-6) q.push(P);
      if (q.length > 2 && q[0].distanceTo(q[q.length - 1]) < 1e-6) q.pop();
      if (q.length < 3) continue;
      const i0 = m.count; for (const P of q) vert(P); for (let k = 1; k < q.length - 1; k++) tri(i0, i0 + k, i0 + k + 1);
    }
  }
  // triangles given outright (a polygon with a hole), all facing n
  tris(list, n, surf, mat = 'solid') {
    const m = this.mesh(surf, mat), r = riseOf(n), t = n.clone().cross(r);
    for (const [A, B, C] of list) {
      const i = m.count; for (const P of [A, B, C]) m.v(P.x, P.y, P.z, n.x, n.y, n.z, P.dot(t), P.dot(r));
      if (B.clone().sub(A).cross(C.clone().sub(A)).dot(n) < 0) m.ix.push(i, i + 2, i + 1); else m.ix.push(i, i + 1, i + 2);
    }
  }
  flush(p) { for (const { m, surf, mat } of this.by.values()) if (m.ix.length) p.add(mat, m.geometry(), surf); this.by.clear(); return p; }
}

// ── one facet of the hull ──
// look: paint (surface), stripe (surface of a band across the middle third, or null), seams ('left': along the edge at
// its lowest x, where a run of pieces starts; 'all': round it), glass (a window: dark glass in a frame), inner (draw
// the inside face, the station's off-white). opts.range: the [lo, hi] the stripe's thirds are measured on (a panel cut
// round a hole keeps its whole panel's stripe); opts.noSeam: edges (by index) never seamed
export function facet(acc, pts, out, look, opts = {}) {
  const o = orient(pts, out); if (!o) return;
  const { n } = o; let P = o.pts;
  if (look.glass) return glassPane(acc, P, n, look);
  const r = riseOf(n);
  if (look.stripe) {
    const ts = P.map((q) => q.dot(r)), [lo, hi] = opts.range || [Math.min(...ts), Math.max(...ts)], c0 = lo + (hi - lo) * 0.36, c1 = lo + (hi - lo) * 0.64;
    acc.poly(clip(P, r, c0, true), n, look.paint);
    acc.poly(clip(clip(P, r, c0, false), r, c1, true), n, look.stripe);
    acc.poly(clip(P, r, c1, false), n, look.paint);
  } else acc.poly(P, n, look.paint);
  if (look.inner !== false) acc.poly(P.map((q) => q.clone().addScaledVector(n, -THICK)).reverse(), n.clone().negate(), SHIP.inner);
  if (look.seams) {
    const minX = Math.min(...P.map((q) => q.x));
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (opts.noSeam?.includes(i)) continue;
      if (look.seams === 'left' && !(Math.abs(a.x - minX) < 1e-4 && Math.abs(b.x - minX) < 1e-4)) continue;
      const inw = n.clone().cross(b.clone().sub(a)).normalize().multiplyScalar(SEAM_W), up = n.clone().multiplyScalar(SEAM_UP);
      acc.poly([a.clone().add(up), b.clone().add(up), b.clone().add(inw).add(up), a.clone().add(inw).add(up)], n, SHIP.trim);
    }
  }
}
// a window: glass sunk a little into the facet, in a charcoal frame round its edge
function glassPane(acc, P, n, look) {
  const fw = look.frameW ?? FRAME_W, inner = inset(P, n, fw), lift = 0.014, sink = -0.022;
  ringFrame(acc, P, inner, n, lift, sink, look.frame || SHIP.frame);
  // (two panes a little apart, each with a face each way: the kit's glass is faint, a canopy's is darker)
  for (const d of [sink, sink - 0.012]) {
    const pane = inner.map((q) => q.clone().addScaledVector(n, d));
    acc.poly(pane, n, null, 'glass', 9); acc.poly(pane.slice().reverse(), n.clone().negate(), null, 'glass', 9);
  }
}
// a frame between an outer loop and an inner loop (both counter-clockwise seen from n, the same count): its face
// raised `lift` off the facet, a lip down to the facet round the outside, and one down to `depth` round the inside
export function ringFrame(acc, outer, inner, n, lift, depth, surf) {
  const L = outer.length, up = (q, d) => q.clone().addScaledVector(n, d);
  for (let i = 0; i < L; i++) {
    const a = outer[i], b = outer[(i + 1) % L], c = inner[(i + 1) % L], d = inner[i];
    acc.poly([up(a, lift), up(b, lift), up(c, lift), up(d, lift)], n, surf);
    const so = n.clone().cross(b.clone().sub(a)).normalize().negate();   // (outward from the loop)
    acc.poly([up(a, 0), up(b, 0), up(b, lift), up(a, lift)], so, surf);
    if (depth < lift) acc.poly([up(d, lift), up(c, lift), up(c, depth), up(d, depth)], so.clone().negate(), surf);
  }
}
// the lining of a hole: each side of the loop (counter-clockwise seen from n) from the outer face to `depth` in,
// facing into the hole
export function lining(acc, loop, n, depth, surf) {
  const L = loop.length;
  for (let i = 0; i < L; i++) {
    const a = loop[i], b = loop[(i + 1) % L], inw = n.clone().cross(b.clone().sub(a)).normalize();
    acc.poly([a.clone(), b.clone(), b.clone().addScaledVector(n, -depth), a.clone().addScaledVector(n, -depth)], inw, surf);
  }
}
