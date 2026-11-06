// THE BUILT SHIPS' SHARED MACHINERY: what Explorer C (explorer-built.js) and the Miner (miner-built.js) both use to
// turn a Meshy smart mesh into the kit's own pieces. Each ship keeps its own data (its palette, its zones and rules,
// its canopy's corners, its gear and doors) and calls these with it.
//   decoding       bytes, decodeMesh: the data modules' base64 int16 positions and uint16 triangles
//   painting       paintFaces: a mesh's faces cut by plane ZONES where a colour line must cross a face, then each
//                  painted by the first of the RULES that matches it; drawFaces puts them in a piece
//   shapes         clipPlane, fan, tnorm, polyTo, boxAt, boxAtGlow, convexHullXZ, rayFaces (the first face a ray meets)
//   the canopy     buildPanes: named panes through named corners on the mesh's canopy, their borders as straight
//                  spars; spar: the one black bar placed along every border; drawCanopy: the glass and its spars
//   the cockpit    cockpitTub: dark walls from the canopy's outline down to its floor, so no gap shows the sky
//   the gear       legLeaves (a leg's strut and foot as kit door leaves), wellDoors, bayDoors and bayPod (a gear pod
//                  and its folding doors), wellWalls, gearStep (legs then doors, in turn)
//   leaves         poseLeaf: a leaf set by hand (a turn, a spin), as the kit's layout code sets it, and more
//   the throttle   THROTTLE, ENGINE, setThrottle: how hard the engines run, 0 to 1
//   the grime      grimeMaterials: the kit's painted material with dirt laid over the clean paint by one amount
// Every function that places geometry takes `dk`, the ship's frame to its pieces' (each built ship's pieces are drawn
// standing on its deck: dk(v) = v lowered by the deck's height).
import * as THREE from 'three';
import { Acc } from '../shipparts/outside/facet.js';
import { part, placeInto } from '../shipparts/place.js';
import { U as KU, kitTextures } from '../materials.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';

export const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ── decoding the data modules ─────────────────────────────────────────────────────────────────────────────────────
export function bytes(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
// a mesh's positions (int16, Q to the metre) and triangles (uint16)
export function decodeMesh(d, Q) { const p = new Int16Array(bytes(d.pos)), pos = new Float32Array(p.length); for (let i = 0; i < p.length; i++) pos[i] = p[i] / Q; return { pos, tris: new Uint16Array(bytes(d.tris)) }; }
export const at = (M, i) => V3(M.pos[i * 3], M.pos[i * 3 + 1], M.pos[i * 3 + 2]);
// the ship's frame to its pieces' (on the deck)
export const deckOf = (DECK) => (v) => V3(v.x, v.y - DECK, v.z);

// ── shapes ───────────────────────────────────────────────────────────────────────────────────────────────────────
// a convex polygon (Vector3s) cut by a plane (on |x|): [inside, outside]
export function clipPlane(P, [a, b, c, d]) {
  const f = (p) => a * Math.abs(p.x) + b * p.y + c * p.z - d, inn = [], out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], fp = f(p), fq = f(q);
    if (fp <= 0) inn.push(p); if (fp >= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const t = fp / (fp - fq), r = p.clone().lerp(q, t); inn.push(r); out.push(r.clone()); }
  }
  const clean = (Q) => Q.filter((v, i) => v.distanceTo(Q[(i + 1) % Q.length]) > 1e-7);
  return [clean(inn), clean(out)];
}
export const fan = (P) => { const out = []; for (let i = 1; i < P.length - 1; i++) out.push([P[0], P[i], P[i + 1]]); return out; };
export const tnorm = ([A, B, C]) => B.clone().sub(A).cross(C.clone().sub(A));
// a flat polygon (ship frame, any winding) facing n, its points in order round it, fanned (convex) or cut (concave)
export function polyTo(acc, pts, n, surf, mat = 'solid', dk) {
  const o = n.clone().normalize(), t = Math.abs(o.y) < 0.9 ? V3(0, 1, 0).cross(o).normalize() : V3(1, 0, 0).cross(o).normalize(), r = o.clone().cross(t);
  const P2 = pts.map((q) => new THREE.Vector2(q.dot(t), q.dot(r)));
  let P = pts; if (THREE.ShapeUtils.isClockWise(P2)) { P = pts.slice().reverse(); P2.reverse(); }
  const tri = THREE.ShapeUtils.triangulateShape(P2, []);
  acc.tris(tri.map((t3) => t3.map((i) => dk(P[i]))), o, surf, mat);
}
// a box along given axes (u, v, w unit, centred at c, half sizes h): its faces out (skip: faces left off, 'u+' ...)
export function boxAt(acc, c, [u, v, w], [hu, hv, hw], surf, skip = [], dk) {
  const P = (a, b, d) => c.clone().addScaledVector(u, a * hu).addScaledVector(v, b * hv).addScaledVector(w, d * hw);
  const F = [['u+', [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], u], ['u-', [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]], u.clone().negate()], ['v+', [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], v], ['v-', [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], v.clone().negate()], ['w+', [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], w], ['w-', [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], w.clone().negate()]];
  for (const [name, corners, n] of F) if (!skip.includes(name)) acc.poly(corners.map((q) => dk(P(...q))), n, surf, 'solid', 99);
}
// a small glowing cube (h half its side) at a point (ship frame)
export function boxAtGlow(acc, c, h, col, dk) {
  for (const [u, v, w] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]]) {
    const n = V3(...u), a = V3(...v).multiplyScalar(h), b = V3(...w).multiplyScalar(h), o = c.clone().addScaledVector(n, h);
    acc.poly([o.clone().sub(a).sub(b), o.clone().add(a).sub(b), o.clone().add(a).add(b), o.clone().sub(a).add(b)].map(dk), n, col, 'glow', 99);
  }
}
// the convex hull of points in plan (x, z), in order round it
export function convexHullXZ(pts) {
  const P = pts.map((v) => [v.x, v.z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of P.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1)).map(([x, z]) => V3(x, 0, z));
}
// the first face a ray meets among `faces` ({ pts, n }; `keep(f)` says which count): { p, n } or null
export function rayFaces(faces, o, d, keep = () => true) {
  let best = null, bt = 1e9;
  for (const f of faces) {
    if (!keep(f)) continue;
    const [A, B, C] = f.pts, e1 = B.clone().sub(A), e2 = C.clone().sub(A), pv = d.clone().cross(e2), det = e1.dot(pv);
    if (Math.abs(det) < 1e-12) continue;
    const tv = o.clone().sub(A), u = tv.dot(pv) / det; if (u < 0 || u > 1) continue;
    const qv = tv.clone().cross(e1), v = d.dot(qv) / det; if (v < 0 || u + v > 1) continue;
    const t = e2.dot(qv) / det; if (t > 1e-4 && t < bt) { bt = t; best = { p: o.clone().addScaledVector(d, t), n: f.n.clone().dot(d) > 0 ? f.n.clone().negate() : f.n.clone() }; }
  }
  return best;
}

// ── PAINTING BY FACE ─────────────────────────────────────────────────────────────────────────────────────────────
// A mesh's triangles (M: decodeMesh; part: a byte per triangle, its index into PARTS plus 128 where its back shows
// through a crack in the skin) cut by the ZONES and painted by the RULES (the first that matches a face paints it):
//   ZONES [{ zone, parts, planes: [[a, b, c, d], ...] }]: a face of those parts is cut along the planes; what lies inside
//         them all (a |x| + b y + c z <= d) is in that zone. A later zone may take a piece from an earlier one.
//   RULES [[why, test(f), paint | paint(f)]]: f { pts, n, c, area, thin, part, zone, back }
// Returns [{ pts, n, c, area, thin, part, zone, back, paint }] (ship frame).
export function paintFaces(M, part, PARTS, ZONES, RULES) {
  let faces = [];
  for (let t = 0; t < M.tris.length / 3; t++) {
    const pts = [0, 1, 2].map((k) => at(M, M.tris[t * 3 + k])), nn = tnorm(pts), area = nn.length() / 2;
    if (area < 1e-9) continue;
    faces.push({ pts, part: PARTS[part[t] & 0x7f], back: !!(part[t] & 0x80), zone: null });
  }
  for (const R of ZONES) {
    const next = [];
    for (const f of faces) {
      if (!R.parts.includes(f.part)) { next.push(f); continue; }
      // (peel off what lies outside each plane; what is left is inside them all)
      let rest = f.pts; const outside = [];
      for (const pl of R.planes) { const [i, o] = clipPlane(rest, pl); if (o.length > 2) outside.push(o); rest = i; if (rest.length < 3) break; }
      if (rest.length < 3) { next.push(f); continue; }
      if (!outside.length) { next.push({ ...f, zone: R.zone }); continue; }
      for (const P of outside) for (const tr of fan(P)) next.push({ ...f, pts: tr });
      for (const tr of fan(rest)) next.push({ ...f, pts: tr, zone: R.zone });
    }
    faces = next;
  }
  return faces.map((f) => {
    const nn = tnorm(f.pts), area = nn.length() / 2, n = nn.normalize(), c = f.pts[0].clone().add(f.pts[1]).add(f.pts[2]).multiplyScalar(1 / 3);
    // (thin: a long narrow strip, its width under 12 cm: the faces along the edges of plates and wings)
    const longest = Math.max(f.pts[0].distanceTo(f.pts[1]), f.pts[1].distanceTo(f.pts[2]), f.pts[2].distanceTo(f.pts[0]));
    const g = { ...f, n, c, area, thin: 2 * area / longest < 0.12 };
    const rule = RULES.find(([, test]) => test(g));
    g.paint = typeof rule[2] === 'function' ? rule[2](g) : rule[2];
    return g;
  }).filter((f) => f.area > 1e-7);
}
// a face's paint run through the rules as if it were there (a door cut from the skin, a pod's side): its surface
export function paintOf(RULES, PAL, f, fallback) { const rule = RULES.find(([, test]) => test(f)); return PAL[typeof rule[2] === 'function' ? rule[2](f) : rule[2]] || fallback; }
// the painted faces into a piece's accumulator: a paint in GLOWS glows, 'glass' and 'gone' (and any `skip`) are not
// drawn here; a face whose back shows through a crack gets a dark back face (backSurf)
export function drawFaces(acc, faces, { PAL, GLOWS = {}, dk, backSurf, skip = ['glass', 'gone'] }) {
  for (const f of faces) {
    if (skip.includes(f.paint)) continue;
    const tri = [f.pts.map(dk)];
    if (GLOWS[f.paint]) acc.tris(tri, f.n, GLOWS[f.paint], 'glow'); else acc.tris(tri, f.n, PAL[f.paint]);
    if (f.back) acc.tris([[tri[0][0], tri[0][2], tri[0][1]]], f.n.clone().negate(), backSurf);
  }
}

// ── THE CANOPY: named panes, straight spars along their borders ───────────────────────────────────────────────────
// The spec C (a ship's CANOPY): corners { name: { at [x, y, z] (port side), r (the middle of the canopy's vertices
// within r; none: the nearest one), mid (on the middle line) } }, side panes [[name, shape, [corners]]] (one each side)
// and top panes [[name, shape, [[corners of a part], ...]]] (a pane bent along its middle given as its parts), straight
// (degrees: two borders meeting within this of a straight line are one spar), and `derive(P, k)` to add corners made
// from others. mesh: { faces (the canopy's triangles, ship frame), verts (their corners, welded) }. outward(n, c):
// turns a normal to face out of the canopy.
// Returns { panes, spars, outline, corners, covers(c, near), dropped, painted, count }.
export function planeOf(P) {
  const n = V3(0, 0, 0), c = V3(0, 0, 0);
  P.forEach((a, i) => { const b = P[(i + 1) % P.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); c.add(a); });
  return { n: n.normalize(), c: c.multiplyScalar(1 / P.length) };
}
export const distSeg = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1))); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside; }
  return inside;
}
export function buildPanes(C, { faces, verts }, outward) {
  // the corners, port (+1) and starboard (-1)
  const spot = (name, s) => {
    const K = C.corners[name], at0 = V3(s * K.at[0], K.at[1], K.at[2]), near = verts.filter((v) => (K.mid || Math.sign(v.x) === s) && v.distanceTo(at0) < (K.r || 0.3));
    if (K.fixed || !near.length) return at0;
    if (!K.r) return near.reduce((b, v) => (v.distanceTo(at0) < b.distanceTo(at0) ? v : b)).clone();
    const m = near.reduce((t, v) => t.add(v), V3(0, 0, 0)).multiplyScalar(1 / near.length); if (K.mid) m.x = 0; return m;
  };
  const P = {};
  for (const s of [1, -1]) {
    const k = s > 0 ? '' : "'";
    for (const name of Object.keys(C.corners)) if (!C.corners[name].mid) P[name + k] = spot(name, s);
    C.derive?.(P, k);
  }
  for (const name of Object.keys(C.corners)) if (C.corners[name].mid) P[name] = spot(name, 1);
  // the panes, each a list of parts (polygons of points; a point's `pass`: no corner, a spar runs straight past it)
  const panes = [];
  const pt = (name, side) => { const pass = name[0] === '~', base = name.replace('~', ''), key = side < 0 && !C.corners[base.replace("'", '')]?.mid ? (base.endsWith("'") ? base.slice(0, -1) : base + "'") : base; return { key, v: P[key], pass }; };
  for (const s of [1, -1]) for (const [name, shape, list] of C.side) panes.push({ name: (s > 0 ? 'port ' : 'starboard ') + name, shape, parts: [list.map((q) => pt(q, s))] });
  for (const [name, shape, parts] of C.top) panes.push({ name, shape, parts: parts.map((list) => list.map((q) => pt(q, 1))) });
  // each pane's glass: its parts cut into triangles (in each part's own plane), facing out; its normals smoothed over
  // the whole pane, so it shades as one piece
  for (const pane of panes) {
    const tris = [];
    for (const part0 of pane.parts) {
      const Q = part0.map((q) => q.v), { n, c } = planeOf(Q); outward(n, c);
      const r = Math.abs(n.y) < 0.9 ? V3(0, 1, 0).cross(n).normalize() : V3(1, 0, 0).cross(n).normalize(), u = n.clone().cross(r);
      const flat = Q.map((v) => new THREE.Vector2(v.dot(r), v.dot(u)));
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(flat, [])) { const T = [Q[i], Q[j], Q[k]]; if (tnorm(T).dot(n) < 0) T.reverse(); tris.push(T); }
      part0.plane = { n, c, r, u, flat: THREE.ShapeUtils.isClockWise(flat) ? flat.slice().reverse() : flat };
    }
    const key = (v) => [v.x, v.y, v.z].map((q) => Math.round(q * 1e4)).join(), sum = new Map();
    for (const T of tris) { const w = tnorm(T); for (const v of T) { const k = key(v); sum.set(k, (sum.get(k) || V3(0, 0, 0)).add(w)); } }
    pane.tris = tris; pane.normalAt = (v) => sum.get(key(v)).clone().normalize();
    pane.n = tris.reduce((t, T) => t.add(tnorm(T)), V3(0, 0, 0)).normalize();
  }
  // the borders: every edge of every part between two points, gathered by the pair of corners at its ends; an edge two
  // panes share is a border between them, one in a single part only the outline (an edge inside one pane, between its
  // two halves, is no border)
  const edges = new Map(), ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  panes.forEach((pane, pi) => pane.parts.forEach((part0, qi) => part0.forEach((q, i) => {
    const q2 = part0[(i + 1) % part0.length], k = ek(q.key, q2.key);
    let E = edges.get(k); if (!E) edges.set(k, (E = { a: q, b: q2, uses: [] })); E.uses.push({ pi, qi });
  })));
  const outline = [], borders = [];
  for (const E of edges.values()) {
    const ps = [...new Set(E.uses.map((u) => u.pi))];
    if (ps.length === 1 && E.uses.length === 2) continue;   // (inside a pane)
    const n = ps.reduce((t, pi) => t.add(panes[pi].n), V3(0, 0, 0)).normalize(), isOut = ps.length === 1;
    const e = { a: E.a, b: E.b, n, outline: isOut, panes: ps.map((pi) => panes[pi].name), pane: ps[0] };
    borders.push(e); if (isOut) outline.push({ a: E.a.v, b: E.b.v, pane: panes[ps[0]] });
  }
  // the spars: borders joined into straight runs, through a point the outline passes (~), or a corner where two of the
  // same kind meet in a straight line
  const runs = borders.map((e) => ({ pts: [e.a, e.b], n: e.n.clone(), outline: e.outline, panes: e.panes, pane: e.pane }));
  const straight = Math.cos(C.straight * PI / 180);
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < runs.length && !merged; i++) for (let j = 0; j < runs.length && !merged; j++) {
      const A = runs[i], Bq = runs[j]; if (i === j || A.outline !== Bq.outline) continue;
      // (A's end meets B's start, either way round)
      for (const [fa, fb] of [[false, false], [false, true], [true, false], [true, true]]) {
        const pa = fa ? A.pts.slice().reverse() : A.pts, pb = fb ? Bq.pts.slice().reverse() : Bq.pts;
        if (pa[pa.length - 1].key !== pb[0].key) continue;
        const da = pa[pa.length - 1].v.clone().sub(pa[0].v).normalize(), db = pb[pb.length - 1].v.clone().sub(pb[0].v).normalize();
        if (!pa[pa.length - 1].pass && da.dot(db) < straight) continue;
        A.pts = pa.concat(pb.slice(1)); A.n.add(Bq.n).normalize(); A.panes = [...new Set(A.panes.concat(Bq.panes))]; runs.splice(j, 1); merged = true; break;
      }
    }
  }
  const spars = runs.map((R) => {
    const a = R.pts[0].v, b = R.pts[R.pts.length - 1].v, along = b.clone().sub(a).normalize(), n = R.n.clone().addScaledVector(along, -R.n.dot(along)).normalize();
    // (the sill: moved out, across the line in the glass's plane, away from its pane's middle)
    let side = V3(0, 0, 0);
    if (R.outline) { side = along.clone().cross(n); if (side.dot(panes[R.pane].tris.flat().reduce((t, v) => t.add(v), V3(0, 0, 0)).multiplyScalar(1 / (3 * panes[R.pane].tris.length)).sub(a)) > 0) side.negate(); }
    return { a, b, n, outline: R.outline, side, panes: R.panes, from: R.pts[0].key, to: R.pts[R.pts.length - 1].key };
  });
  // the canopy's faces the panes cover (their middles inside a part, near its plane): dropped
  // (a point under a pane: within `near` of its plane, inside its outline or within 4 cm of it, so the strips along
  // a border between two panes go with them)
  const inPart = (c, near = 0.3) => panes.some((pane) => pane.parts.some((q) => { const L = q.plane; if (Math.abs(c.clone().sub(L.c).dot(L.n)) > near) return false; const p2 = new THREE.Vector2(c.dot(L.r), c.dot(L.u)); return pointInPoly(p2, L.flat) || L.flat.some((a, i) => distSeg(p2, a, L.flat[(i + 1) % L.flat.length]) < 0.04); }));
  const covered = (f) => inPart(f.reduce((t, v) => t.add(v), V3(0, 0, 0)).multiplyScalar(1 / 3));
  return { panes, spars, outline, corners: P, covers: inPart, dropped: faces.filter(covered).length, painted: faces.filter((f) => !covered(f)).length, count: panes.length };
}
// THE SPAR: one part, a bar 1 m long along z, 1 across (x; placed, it is stretched to the spar's width), standing
// `out` out of the glass and `in` into it (y is out of the glass); placed along each spar, stretched to its length and
// a width more, so the bars meet and overlap at every corner: none stops short. opts { out, in, surf }
export function spar(p, { out, in: dep, surf }) {
  const acc = new Acc(), x0 = -0.5, x1 = 0.5, y0 = -dep, y1 = out, z0 = -0.5, z1 = 0.5;
  const q = (pts, n) => acc.poly(pts.map((a) => V3(...a)), V3(...n), surf, 'solid', 99);
  q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);      // its face
  q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);      // its sides
  q([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]);
  q([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]);     // its back (seen from inside)
  return acc.flush(p);
}
const _m = new THREE.Matrix4(), _e = new THREE.Euler();
// the glass: smoked, `inset` in from the frame's face, seen from outside and from the seats (a face each way); each
// pane's triangles cut evenly into ones no longer than `step` (its normals blended across them, so the pane shades
// smooth; and the checks can cut a hole in it). Then the spars: S.spar { w, out, in } between panes, S.sill { w, out,
// shift } round the outline (wider, lower, moved out by shift), and a square at each outline corner. sparPart: the
// spar part (part(spar, {...})).
export function drawCanopy(p, { panes, spars }, S, GLASS, sparPart, dk) {
  const acc = new Acc(), m = acc.mesh(null, 'glass');
  for (const pane of panes) {
    const k = Math.max(1, Math.ceil(Math.max(...pane.tris.flatMap((T) => [0, 1, 2].map((i) => T[i].distanceTo(T[(i + 1) % 3])))) / GLASS.step));
    for (const T of pane.tris) {
      const N = T.map((v) => pane.normalAt(v)), at2 = (i, j) => { const u = i / k, w = j / k, n = N[0].clone().multiplyScalar(1 - u - w).addScaledVector(N[1], u).addScaledVector(N[2], w).normalize(); return { v: dk(T[0].clone().multiplyScalar(1 - u - w).addScaledVector(T[1], u).addScaledVector(T[2], w)).addScaledVector(n, -GLASS.inset), n }; };
      const tri = (A, B, C) => { for (const [Q, sg] of [[[A, B, C], 1], [[A, C, B], -1]]) { const i0 = m.count; for (const q of Q) m.v(q.v.x, q.v.y, q.v.z, sg * q.n.x, sg * q.n.y, sg * q.n.z); m.ix.push(i0, i0 + 1, i0 + 2); } };
      for (let i = 0; i < k; i++) for (let j = 0; j < k - i; j++) { tri(at2(i, j), at2(i + 1, j), at2(i, j + 1)); if (i + j < k - 1) tri(at2(i + 1, j), at2(i + 1, j + 1), at2(i, j + 1)); }
    }
  }
  acc.flush(p);
  const { w, out } = S.spar, { w: ws, shift } = S.sill, low = S.sill.out / out;
  for (const sp of spars) {
    const a = dk(sp.a), b = dk(sp.b), along = b.clone().sub(a), len = along.length(); if (len < 0.01) continue;
    const z = along.normalize(), y = sp.n, x = y.clone().cross(z), wide = sp.outline ? ws : w;
    _m.makeBasis(x, y, z); _e.setFromRotationMatrix(_m);
    const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(sp.side, sp.outline ? shift : 0);
    placeInto(p, sparPart, { at: mid.toArray(), rot: [_e.x, _e.y, _e.z], scale: [wide, sp.outline ? low : 1, len + wide] });
  }
  // (at each corner of the outline, where two sill spars meet at an angle, a square of the same spar fills the notch
  // between their ends)
  const ends = new Map();
  for (const sp of spars) if (sp.outline) for (const [k, v] of [[sp.from, sp.a], [sp.to, sp.b]]) { const e = ends.get(k) || { v, sp: [] }; e.sp.push(sp); ends.set(k, e); }
  for (const { v, sp: two } of ends.values()) {
    if (two.length !== 2) continue;
    const y = two[0].n.clone().add(two[1].n).normalize(), side = two[0].side.clone().add(two[1].side).normalize();
    const z = side.clone().addScaledVector(y, -side.dot(y)).normalize(), x = y.clone().cross(z);
    _m.makeBasis(x, y, z); _e.setFromRotationMatrix(_m);
    placeInto(p, sparPart, { at: dk(v).addScaledVector(side, shift).toArray(), rot: [_e.x, _e.y, _e.z], scale: [ws, low, ws] });
  }
  return p;
}

// ── THE COCKPIT ───────────────────────────────────────────────────────────────────────────────────────────────────
// The cockpit family's parts (kit/shipparts/cockpit), as its sample cockpit puts them (cockpitPlan): C { seats, gap,
// wallX, canopy, dash, floor, seatsZ }; `drop` names the parts left out (a regexp)
export function builtCockpitPlan(C, drop) {
  const plan = cockpitPlan({ seats: C.seats ?? 2, gap: C.gap, wallX: C.wallX, canopy: C.canopy, seat: { shape: 'bucket', look: 'ship' }, dash: { ...C.dash } });
  plan.items = plan.items.filter((it) => !drop.test(it.name));
  plan.reach = plan.reach.filter((r) => !drop.test(r.name));
  return plan;
}
export function cockpitParts(p, plan, C) {
  const place = (at2) => [at2[0], at2[1] + C.floor, at2[2] + C.seatsZ];
  for (const it of plan.items) placeInto(p, part(BUILDS[it.build], it.opts), { at: place(it.at), rot: it.rot, scale: it.scale });
}
// THE TUB: everything under the glass closed, so no gap shows the sky from the seats (and nobody sees into the empty
// hull through the canopy): from every edge of the canopy's outline a dark wall down and in to the floor at fy (ship
// frame), which reaches out to them (no wider than tubX each side, nor than the hull there less 10 cm: rayIn(o, d)
// finds the hull's inside from the middle line); the floor a dark deck. Returns the floor's outline (plan).
export function cockpitTub(acc, outline, { fy, tubX, rayIn, wallSurf, floorSurf, dk }) {
  const inside = new Map(), halfAt = (s, z) => { const k = s + ':' + z.toFixed(3); if (!inside.has(k)) { const h = rayIn(V3(0, fy + 0.04, z), V3(s, 0, 0)); inside.set(k, h ? Math.abs(h.p.x) - 0.1 : 0); } return inside.get(k); };
  const foot = (v) => { const s = Math.sign(v.x) || 1; return V3(s * Math.max(0, Math.min(Math.abs(v.x), tubX, halfAt(s, v.z))), fy, v.z); };
  const ctr = outline.reduce((s2, sp) => s2.add(sp.a).add(sp.b), V3(0, 0, 0)).multiplyScalar(1 / (2 * outline.length));
  for (const sp of outline) {
    const q = [sp.a, sp.b, foot(sp.b), foot(sp.a)], n = tnorm(q.slice(0, 3)).lengthSq() > 1e-10 ? tnorm(q.slice(0, 3)).normalize() : tnorm([q[0], q[2], q[3]]).normalize();
    // (facing into the cockpit)
    const mid = sp.a.clone().add(sp.b).multiplyScalar(0.5); if (n.dot(V3(ctr.x - mid.x, 0, ctr.z - mid.z)) < 0) n.negate();
    if (Math.abs(sp.a.y - fy) < 0.02 && Math.abs(sp.b.y - fy) < 0.02) continue;
    const pts = q.filter((v, i) => q.findIndex((w) => w.distanceTo(v) < 1e-6) === i);
    if (pts.length >= 3) acc.poly(pts.map(dk), n, wallSurf, 'solid', 99);
  }
  const fl = []; for (const sp of outline) fl.push(foot(sp.a), foot(sp.b));
  const hull2 = convexHullXZ(fl);
  polyTo(acc, hull2.map((v) => V3(v.x, fy, v.z)), V3(0, 1, 0), floorSurf, 'solid', dk);
  return hull2;
}

// ── THE GEAR ─────────────────────────────────────────────────────────────────────────────────────────────────────
// a leg's data (a GEAR entry: its mesh, the foot's flags, its fold) as the strut's and the foot's faces, mirrored for
// starboard, with its hinge and ankle placed and its turns in radians
export function legMesh(G, Q, mirror) {
  const M = decodeMesh(G, Q), foot = new Uint8Array(bytes(G.foot)), F = G.fold;
  const P = (i) => { const v = at(M, i); if (mirror) v.x = -v.x; return v; };
  const out = { strut: [], foot: [] };
  for (let t = 0; t < M.tris.length / 3; t++) {
    let tri = [0, 1, 2].map((k) => P(M.tris[t * 3 + k])); if (mirror) tri = [tri[0], tri[2], tri[1]];
    const n = tnorm(tri); if (n.lengthSq() < 1e-14) continue;
    (foot[t] ? out.foot : out.strut).push({ tri, n: n.normalize() });
  }
  const m = mirror ? -1 : 1, H = V3(m * F.hinge[0], F.hinge[1], F.hinge[2]), A = V3(m * F.ankle[0], F.ankle[1], F.ankle[2]);
  // (mirrored, a turn about z goes the other way; about x, the same)
  const sg = mirror && F.axis[2] ? -1 : 1;
  return { ...out, H, A, axis: F.axis, a1: sg * F.a1 * PI / 180, a2: sg * F.a2 * PI / 180, slide: F.slide ? [m * F.slide[0], F.slide[1], F.slide[2]] : [0, 0, 0] };
}
// a leg as two leaves of one kit door: the strut turns a1 about its hinge, the foot a2 more about its ankle. key: the
// leaves' name stem ('eb'); paint(f, isFoot): a face's surface; door: the door's id; tf: the leaves' geometry moved (a
// point in the ship's frame to where it is drawn: scale, shift), if any
export function legLeaves(p, G, { key, which, dk, paint, door = 'gear', speed, tf = (v) => v }) {
  const h1 = { at: dk(tf(G.H)).toArray(), axis: G.axis, angle: G.a1 };
  const draw = (list, isFoot) => (lp) => { const acc = new Acc(); for (const f of list) acc.tris([f.tri.map((v) => dk(tf(v)))], f.n, paint(f, isFoot)); acc.flush(lp); };
  p.leaf(`${key}:strut:${which}`, draw(G.strut, false), { door, hinge: h1, slide: G.slide });
  p.leaf(`${key}:foot:${which}`, draw(G.foot, true), { door, hinge: [h1, { at: dk(tf(G.A)).toArray(), axis: G.axis, angle: G.a2 }], slide: G.slide });
  p.door(door, [0, dk(V3(0, 0, 0)).y, 0], 0, speed);
  return p;
}
// turning about a line (a point on it and its direction), as a matrix; a matrix as a leaf's pose
export const turnAbout = (a, axis, ang) => new THREE.Matrix4().makeTranslation(a.x, a.y, a.z).multiply(new THREE.Matrix4().makeRotationAxis(axis, ang)).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
export const leafPose = (M) => { const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(); M.decompose(pos, q, scl); const e = new THREE.Euler().setFromQuaternion(q); return { at: pos.toArray(), rot: [e.x, e.y, e.z] }; };
// (a panel: its outer face painted (paint(P, n)), its inner face dark, 3 cm in; P in the ship's frame, n its outward
// normal)
export const panel = (acc, P, n, paint, inner, dk) => { acc.poly(P.map(dk), n, paint(P, n), 'solid', 99); acc.poly(P.map((v) => dk(v.clone().addScaledVector(n, -0.03))).reverse(), n.clone().negate(), inner, 'solid', 99); };
// a well's doors: the belly's skin cut out of it, each half a list of convex polygons hinged at two points on the
// well's edge; each hangs open (`open` radians, down) while the gear is down and shuts flush into the belly when it is
// up. paint(P, n): the outer face's surface. (The door 'doors': open = shut, here: t 1 is shut.)
export function wellDoors(p, halves, { key, which, open, paint, inner, dk }) {
  halves.forEach((half, i) => {
    const a = dk(V3(...half.hinge[0])), b = dk(V3(...half.hinge[1])), axis = b.clone().sub(a).normalize();
    // (which way is down: turn so the half's middle drops)
    const mid = dk(half.polys.flat().reduce((t, q) => t.add(V3(...q)), V3(0, 0, 0)).multiplyScalar(1 / half.polys.flat().length));
    const R = (ang) => new THREE.Matrix4().makeTranslation(a.x, a.y, a.z).multiply(new THREE.Matrix4().makeRotationAxis(axis, ang)).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
    const o = mid.clone().applyMatrix4(R(open)).y < mid.clone().applyMatrix4(R(-open)).y ? open : -open;
    const base = R(o), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(); base.decompose(pos, q, scl);
    const e = new THREE.Euler().setFromQuaternion(q);
    p.leaf(`${key}:well door:${which}:${i}`, (lp) => {
      const acc = new Acc();
      for (const poly of half.polys) {
        const P = poly.map((q2) => V3(...q2)), n = tnorm(P.slice(0, 3)).normalize(); if (n.y > 0) n.negate();
        acc.poly(P.map(dk), n, paint(P, n), 'solid', 99);
        acc.poly(P.map((v) => dk(v.clone().addScaledVector(n, -0.03))).reverse(), n.clone().negate(), inner, 'solid', 99);
      }
      acc.flush(lp);
    }, { at: pos.toArray(), rot: [e.x, e.y, e.z], door: 'doors', hinge: { at: a.toArray(), axis: axis.toArray(), angle: -o } });
  });
}
// A GEAR POD (a bay): B { x [inboard, outboard] (port side's |x|), z [aft, fore], belly [y at the aft and fore ends:
// the doors' plane], wallTop (the pod's side up to here), ceil (inside, under the deck, as far out as step), step,
// roof (out to the pod's side), axle [x, y] (the strut's turning point), strip (optional: the low strip of its side, a
// flap), mirror (starboard) }
export const bayOf = (B) => ({ s: B.mirror ? -1 : 1, yb: (z) => B.belly[0] + (B.belly[1] - B.belly[0]) * (z - B.z[0]) / (B.z[1] - B.z[0]), zm: (B.z[0] + B.z[1]) / 2 });
// the pod's bottom as its doors: from each end to the middle, in two leaves: A at the end, hinged on the bay's edge,
// swings straight down; B, its inner part, folds back up against A's outside as A swings (hinged on A's free edge, 1.5
// cm out, so it lies 3 cm off it), so the halves hang no lower than a quarter of the bay's length; and the side's low
// strip, if any: one flap the bay's length, hinged along its top, swinging out and up (flapOpen radians)
export function bayDoors(p, which, B, { key, paint, inner, dk, flapOpen = 1.75 }) {
  const { s, yb, zm } = bayOf(B), X = (x) => s * x, ax = V3(1, 0, 0);
  [[B.z[0], 1], [B.z[1], -1]].forEach(([ze, dir], h) => {
    const L = Math.abs(zm - ze), zA = ze + dir * L / 2, phi = dir * PI / 2, psi = dir * PI;
    const bottom = (z1, z2) => [V3(X(B.x[0]), yb(z1), z1), V3(X(B.x[1]), yb(z1), z1), V3(X(B.x[1]), yb(z2), z2), V3(X(B.x[0]), yb(z2), z2)];
    const nb = (() => { const P = bottom(B.z[0], B.z[1]), n = tnorm(P.slice(0, 3)).normalize(); return n.y > 0 ? n.negate() : n; })();
    const e = dk(V3(0, yb(ze), ze)), E = turnAbout(e, ax, phi);
    const f = dk(V3(0, yb(zA), zA)).applyMatrix4(E).add(V3(0, 0, -dir * 0.015)), F = turnAbout(f, ax, psi);
    const build = (z1, z2) => (lp) => { const acc = new Acc(); panel(acc, bottom(z1, z2), nb, paint, inner, dk); acc.flush(lp); };
    p.leaf(`${key}:bay door:${which}:${h}a`, build(ze, zA), { ...leafPose(E), door: 'doors', hinge: { at: e.toArray(), axis: ax.toArray(), angle: -phi } });
    p.leaf(`${key}:bay door:${which}:${h}b`, build(zA, zm), { ...leafPose(F.clone().multiply(E)), door: 'doors', hinge: [{ at: e.toArray(), axis: ax.toArray(), angle: -phi }, { at: f.toArray(), axis: ax.toArray(), angle: -psi }] });
  });
  if (B.strip == null) return;
  const az = V3(0, 0, 1), top = dk(V3(X(B.x[1]), B.strip, 0)), th = s * flapOpen, FL = turnAbout(top, az, th);
  const strip = [V3(X(B.x[1]), yb(B.z[0]), B.z[0]), V3(X(B.x[1]), B.strip, B.z[0]), V3(X(B.x[1]), B.strip, B.z[1]), V3(X(B.x[1]), yb(B.z[1]), B.z[1])];
  p.leaf(`${key}:bay flap:${which}`, (lp) => { const acc = new Acc(); panel(acc, strip, V3(s, 0, 0), paint, inner, dk); acc.flush(lp); }, { ...leafPose(FL), door: 'doors', hinge: { at: top.toArray(), axis: az.toArray(), angle: -th } });
}
// the gear pod's outside (its side over the doors or the flap, up to the hull's overhang, and its ends, painted by
// paint(P, n)), the bay's inside dark (the inner wall, the ceiling under the deck, the step and the roof over the pod)
// and the axle the strut turns on
export function bayPod(acc, B, { paint, dark, metal, dk }) {
  const { s, yb } = bayOf(B), X = (x) => s * x, [x0, x1] = B.x, wt = B.wallTop ?? B.roof;
  const sec = (z) => [[x0, yb(z)], [x1, yb(z)], [x1, wt], [B.step, B.roof], [B.step, B.ceil], [x0, B.ceil]].map(([x, y]) => V3(X(x), y, z));
  const [a, f] = [sec(B.z[0]), sec(B.z[1])];
  const lo = (z) => B.strip ?? yb(z);
  panel(acc, [V3(X(x1), lo(B.z[0]), B.z[0]), V3(X(x1), wt, B.z[0]), V3(X(x1), wt, B.z[1]), V3(X(x1), lo(B.z[1]), B.z[1])], V3(s, 0, 0), paint, dark, dk);
  for (const [P, nz] of [[a, -1], [f, 1]]) { polyTo(acc, P, V3(0, 0, nz), paint(P, V3(0, 0, nz)), 'solid', dk); polyTo(acc, P, V3(0, 0, -nz), dark, 'solid', dk); }
  const quad = (p0, p1) => [V3(X(p0[0]), p0[1], B.z[0]), V3(X(p1[0]), p1[1], B.z[0]), V3(X(p1[0]), p1[1], B.z[1]), V3(X(p0[0]), p0[1], B.z[1])];
  for (const [P, n] of [[quad([B.step, B.roof], [x1, B.roof]), V3(0, -1, 0)], [quad([B.step, B.ceil], [B.step, B.roof]), V3(s, 0, 0)], [quad([x0, B.ceil], [B.step, B.ceil]), V3(0, -1, 0)]]) {
    acc.poly(P.map(dk), n, dark, 'solid', 99); acc.poly(P.map(dk), n.clone().negate(), dark, 'solid', 99);
  }
  { const P = [a[5], a[0], f[0], f[5]]; acc.poly(P.map(dk), V3(s, 0, 0), dark, 'solid', 99); }
  boxAt(acc, V3(X(B.axle[0]), B.axle[1], (B.z[0] + B.z[1]) / 2), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.06, 0.06, (B.z[1] - B.z[0]) / 2 - 0.01], metal, ['w+', 'w-'], dk);   // (its ends 1 cm inside the end walls, unseen)
}
// a well (W { box, rim, ceil }): dark walls standing on its rim up to its ceiling, and the ceiling (or, with `ceil`,
// lower (ceil.low) aft of ceil.z, a step up between them)
export function wellWalls(acc, W, { dark, dk }) {
  const [mn, mx] = W.box, c = V3((mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2), zs = W.ceil?.z ?? -Infinity, topAt = (z) => (z < zs ? W.ceil.low : mx[1]);
  for (const [a0, b0] of W.rim) {
    const a = V3(...a0), b = V3(...b0), n = b.clone().sub(a).cross(V3(0, 1, 0)).normalize();
    if (n.dot(V3(c.x - a.x, 0, c.z - a.z)) < 0) n.negate();
    const parts = (a.z - zs) * (b.z - zs) < 0 ? (() => { const m = a.clone().lerp(b, (zs - a.z) / (b.z - a.z)); return [[a, m], [m, b]]; })() : [[a, b]];
    for (const [u, v] of parts) {
      const top = topAt((u.z + v.z) / 2), [q] = clipPlane([u, v, V3(v.x, top, v.z), V3(u.x, top, u.z)], [0, 1, 0, top]);
      if (q.length > 2) acc.poly(q.map(dk), n, dark, 'solid', 99);
    }
  }
  const roof = (z0, z1, y) => acc.poly([V3(mn[0], y, z0), V3(mx[0], y, z0), V3(mx[0], y, z1), V3(mn[0], y, z1)].map(dk), V3(0, -1, 0), dark, 'solid', 99);
  if (W.ceil) { roof(mn[2], zs, W.ceil.low); roof(zs, mx[2], mx[1]); acc.poly([V3(mn[0], W.ceil.low, zs), V3(mx[0], W.ceil.low, zs), V3(mx[0], mx[1], zs), V3(mn[0], mx[1], zs)].map(dk), V3(0, 0, 1), dark, 'solid', 99); }
  else roof(mn[2], mx[2], mx[1]);
}
// MOVING THE GEAR (the game, or the lab): up folds the legs, then shuts the wells' doors; down opens the doors, then
// lowers the legs. built: buildRoom's result; updateDoors: the kit's (kit/layout.js; passed in, as these files are part
// of the catalog the layout code reads); legs, doors: the pieces' names. Returns whether anything moved. (The doors' t
// runs 0 open to 1 shut.)
export function gearStep(built, up, dt, updateDoors, legsPiece = 'ebGear', doorsPiece = 'ebGearDoors') {
  const legs = built.doors.filter((D) => D.piece === legsPiece), doors = built.doors.filter((D) => D.piece === doorsPiece), eye = new THREE.Vector3();
  if (up) { const m = updateDoors(legs, eye, dt, 'open'); return legs.every((D) => D.t >= 1) ? updateDoors(doors, eye, dt, 'open') || m : m; }
  const m = updateDoors(doors, eye, dt, 'shut'); return doors.every((D) => D.t <= 0) ? updateDoors(legs, eye, dt, 'shut') || m : m;
}
// A LEAF SET BY HAND, as the kit's layout code sets one (kit/layout.js setLeaf: placed by M, slid, each hinge in turn
// by its angle times the eased t, then its base), with `extra` (a matrix in the leaf's own frame, before its base: a
// spin about its own axis) and per-hinge t's (ts: a list, one per hinge, or one t for all); scale 0 hides it
const ease = (t) => t * t * (3 - 2 * t);
const _lm = new THREE.Matrix4(), _lh = new THREE.Matrix4(), _lp = new THREE.Vector3(), _la = new THREE.Vector3();
export function poseLeaf(leaf, ts, extra = null, hide = false) {
  const tl = Array.isArray(ts) ? ts : null, t0 = tl ? (tl[0] ?? 0) : ts;
  _lm.copy(leaf.M).multiply(_lh.makeTranslation(leaf.slide.x * ease(t0), leaf.slide.y * ease(t0), leaf.slide.z * ease(t0)));
  if (leaf.hinge) leaf.hinge.forEach((H, i) => {
    const t = tl ? (tl[i] ?? 0) : ts;
    _lp.fromArray(H.at); _la.fromArray(H.axis);
    _lm.multiply(_lh.makeTranslation(_lp.x, _lp.y, _lp.z)).multiply(_lh.makeRotationAxis(_la, H.angle * (tl ? t : ease(t)))).multiply(_lh.makeTranslation(-_lp.x, -_lp.y, -_lp.z));
  });
  if (extra) _lm.multiply(extra);
  _lm.multiply(leaf.base);
  if (hide) _lm.scale(_lp.set(1e-4, 1e-4, 1e-4));
  for (const im of leaf.meshes) { im.setMatrixAt(leaf.index, _lm); im.instanceMatrix.needsUpdate = true; }
  return _lm;
}

// ── THE THROTTLE: how hard the engines run, 0 (off) to 1 (full afterburn); THROTTLE names the lab's settings ─────────
export const THROTTLE = { Off: 0, Idle: 0.15, Half: 0.5, Full: 0.8, Afterburn: 1 };
// (the colour the throttle gives a core: a dull deep orange at idle, bright orange, then hot white-yellow at full
// power, and blue at full afterburn (linear colours, over 1 for the bloom). ENGINE.color is the uniform a glow reads.)
const HEAT = [[0, [0, 0, 0]], [0.04, [0.05, 0.009, 0.0015]], [0.15, [0.2, 0.04, 0.006]], [0.5, [0.85, 0.22, 0.03]], [0.8, [2.2, 1.5, 0.55]], [0.92, [1.0, 1.1, 2.0]], [1, [0.1, 0.45, 3.2]]];
export const ENGINE = { throttle: 0, color: { value: new THREE.Color(0, 0, 0) } };
export function setThrottle(t) {
  t = Math.max(0, Math.min(1, t)); ENGINE.throttle = t;
  let i = 1; while (i < HEAT.length - 1 && HEAT[i][0] < t) i++;
  const [t0, c0] = HEAT[i - 1], [t1, c1] = HEAT[i], u = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 1;
  ENGINE.color.value.setRGB(c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u);
  for (const f of ENGINE.listeners) f(t);
  return t;
}
ENGINE.listeners = [];

// ── THE GRIME: the kit's painted material, with dirt laid over the clean paint by one amount (uDirt, 0 clean to 1
// filthy; the clean look is the base). Cheap: a few texture reads and one short loop per pixel.
//   crevices and joins   darker where the bake's corner darkening says the sky is hidden (where parts meet)
//   blotches             big soft patches of grime from the kit's wear texture, read large over the ship
//   streaks              soot and runs trailing from the ship's streaks (its vents and nozzles), along their flow,
//                        widening and fading, broken into runs by the wear texture read long and thin
//   worn edges           the thin faces along exposed edges (the 'Edge' paints, which take more wear): paint chipped
//                        to bare metal in the wear texture's scuff pattern
// grimeMaterials(mats, { dirt, streaks, deck, grime, key }) returns the material set with its painted material (and the
// door leaves') swapped for these; grime.dirt.value changes the amount live. streaks: [[x, y, z (ship frame), flow dx,
// dy, dz, length, width], ...]. The streaks are where the ship's parts are, so they apply to the static parts (the
// leaves move, so they take the rest but no streaks).
export function grimePatch(mat, inst, wear, { streaks, deck, grime, key }) {
  mat.defines = { ...(mat.defines || {}), KIT_RMW: '', ...(inst ? { KIT_INST: '' } : { EB_STREAKS: '' }) };
  const src = streaks.map((q) => new THREE.Vector4(q[0], q[1] - deck, q[2], q[6])), dir = streaks.map((q) => new THREE.Vector4(...new THREE.Vector3(q[3], q[4], q[5]).normalize().toArray(), q[7]));
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uWear: { value: wear }, uAODirect: KU.aoDirect, uBakeGain: KU.bakeGain, uAOStrength: KU.aoStrength, uDirt: grime.dirt, uSrc: { value: src }, uDir: { value: dir } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aAO; attribute vec3 aRMW;
#ifdef KIT_INST
attribute vec3 iBake;
#else
attribute vec3 aBake;
#endif
varying float vAO; varying vec3 vBake; varying vec2 vWearUv; varying vec3 vRMW; varying vec3 vPos;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vAO = aAO; vWearUv = uv; vRMW = aRMW; vPos = position;
#ifdef KIT_INST
vBake = iBake;
#else
vBake = aBake;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uWear; uniform float uAODirect, uBakeGain, uAOStrength, uDirt;
uniform vec4 uSrc[${src.length}]; uniform vec4 uDir[${src.length}];
varying float vAO; varying vec3 vBake; varying vec2 vWearUv; varying vec3 vRMW; varying vec3 vPos;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 wearT = texture2D( uWear, vWearUv * 0.5 ).rgb, blot = texture2D( uWear, vWearUv * 0.11 + 0.31 ).rgb;
  float take = vRMW.z, lum0 = dot( diffuseColor.rgb, vec3( 0.3333 ) );
  float grime = ( 1.0 - vAO ) * 1.25 + blot.r * take * 0.45;
#ifdef EB_STREAKS
  float st = 0.0;
  for ( int i = 0; i < ${src.length}; i++ ) {
    vec3 d = vPos - uSrc[ i ].xyz; float along = dot( d, uDir[ i ].xyz );
    if ( along > 0.0 && along < uSrc[ i ].w ) {
      float f = along / uSrc[ i ].w, across = length( d - along * uDir[ i ].xyz ), w = uDir[ i ].w * ( 1.0 + 0.8 * f );
      st = max( st, ( 1.0 - f ) * ( 1.0 - smoothstep( w * 0.35, w, across ) ) );
    }
  }
  float runs = texture2D( uWear, vec2( ( vPos.x + vPos.z ) * 0.9, vPos.y * 0.06 + vPos.z * 0.04 ) ).r;
  grime += st * ( 0.35 + 0.9 * runs );
#endif
  diffuseColor.rgb *= 1.0 - clamp( uDirt * grime * 0.55, 0.0, 0.7 );
  // (worn edges: chipped paint on the thin edge faces, bare metal showing through)
  float chip = uDirt * smoothstep( 0.8, 0.98, take ) * smoothstep( 0.35, 0.75, wearT.g );
  diffuseColor.rgb = mix( diffuseColor.rgb, lum0 < 0.25 ? vec3( 0.42, 0.43, 0.45 ) : vec3( 0.55, 0.56, 0.57 ), chip * 0.85 );
  diffuseColor.rgb *= 0.97 + 0.06 * wearT.b;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp( vRMW.x + uDirt * ( blot.r * 0.15 + wearT.r * 0.1 ) * take, 0.04, 1.0 );`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = mix( vRMW.y, 0.75, chip );`)
      .replace('#include <aomap_fragment>', `
  float ambientOcclusion = mix( 1.0, vAO, uAOStrength );
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, uAODirect );
  reflectedLight.directSpecular *= mix( 1.0, ambientOcclusion, uAODirect );
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNVao = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVao, ambientOcclusion, material.roughness );
  #endif
  reflectedLight.indirectDiffuse += vBake * uBakeGain * BRDF_Lambert( material.diffuseColor ) * mix( 1.0, ambientOcclusion, 0.35 );`);
  };
  mat.customProgramCacheKey = () => key + (inst ? 'i' : '');
  return mat;
}
// the kit's material set with the painted ones swapped for grime; a smoked glass for the canopy (one layer: the seats
// show through it); and the glow with the engines' cores lit by the throttle (a core's colour is its mark, CORE: its
// heat times ENGINE.color; every other glow as it was)
export function grimeMaterials(mats, { dirt, streaks, deck, grime, key = 'ebgrime', glowKey = 'ebglow' }) {
  if (dirt != null) grime.dirt.value = dirt;
  const wear = kitTextures().wear, M = { ...mats }, o = { streaks, deck, grime, key };
  M.solid = grimePatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), false, wear, o);
  M.solidInst = grimePatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), true, wear, o);
  M.glass = new THREE.MeshStandardMaterial({ color: 0x0d1720, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 0.9 });
  M.glassInst = M.glass;
  M.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  M.glow.onBeforeCompile = (sh) => {
    sh.uniforms.uEngine = ENGINE.color;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uEngine;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  if ( vColor.r < -0.5 ) diffuseColor.rgb = uEngine * ( -vColor.r - 1.0 );');
  };
  M.glow.customProgramCacheKey = () => glowKey;
  M.glowInst = M.glow;
  M.solid.name = 'solid'; M.solidInst.name = 'solidInst'; M.glass.name = 'glass'; M.glow.name = 'glow';
  return M;
}
