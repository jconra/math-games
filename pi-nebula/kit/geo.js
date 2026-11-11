// GEOMETRY for the station kit, all built in code: bevelled boxes with smooth rounded edges, a profile swept along a
// path (rims, pipes, cables, strips, door frames), arches, extrusions and lathes. Everything comes out as an indexed
// BufferGeometry with position, normal and uv (uv in metres across the face, so one tiling texture keeps one scale).
// Big flat faces get extra rows of vertices near their edges: the corner darkening and the strip light are baked per
// vertex, and a bare quad would smear them across the whole face.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export class MeshData {
  constructor() { this.p = []; this.n = []; this.uv = []; this.ix = []; }
  get count() { return this.p.length / 3; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); return this.count - 1; }
  quad(a, b, c, d) { this.ix.push(a, b, c, a, c, d); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.ix); return g;
  }
}

// ── the rows of vertices across one face: the bevel's arc at each end (spaced so the angle steps evenly), two rows
// close to each edge, then even steps no longer than `cell` ──
function rows(h, r, seg, cell, loops) {
  const inner = h - r, out = [];
  for (let k = 0; k <= seg; k++) { const t = r > 0 ? r * Math.tan(Math.PI / 4 * k / seg) : 0; out.push(inner + t, -(inner + t)); }
  for (const d of loops) if (inner - d > 0.02) out.push(inner - d, -(inner - d));
  out.sort((a, b) => a - b);
  const u = [out[0]];
  for (let i = 1; i < out.length; i++) if (out[i] - u[u.length - 1] > 1e-5) u.push(out[i]);
  const f = [u[0]];
  for (let i = 1; i < u.length; i++) {
    const gap = u[i] - u[i - 1], n = Math.ceil(gap / cell - 1e-6);
    for (let k = 1; k < n; k++) f.push(u[i - 1] + gap * k / n);
    f.push(u[i]);
  }
  return f;
}

// faces of a box: the normal's axis and sign, and two in-face axes whose cross product is the normal
const FACES = { '+x': [0, 1, 1, 2], '-x': [0, -1, 2, 1], '+y': [1, 1, 2, 0], '-y': [1, -1, 0, 2], '+z': [2, 1, 0, 1], '-z': [2, -1, 1, 0] };

// A box of size [sx, sy, sz] centred at `at`, its edges rounded to radius r with smooth normals.
//   opts: r (0.01), seg (bevel steps per face, 1: the edge's quarter round in two steps, smooth normals), cell (largest step across a face, 0.4), skip (faces to leave out,
//   e.g. ['-z'] for a panel's hidden back), loops (extra rows this far in from each edge)
export function bevelBox(size, at = [0, 0, 0], opts = {}) {
  const h = size.map((s) => s / 2), m = new MeshData();
  // (a box under 6 cm every way is too small to show a rounded edge: it stays sharp, 12 triangles)
  const tiny = Math.max(...size) < 0.06 && !opts.round;
  const r = tiny ? 0 : Math.min(opts.r ?? 0.01, Math.min(...h) * 0.98), seg = r > 0 ? (opts.seg ?? 1) : 0, cell = opts.cell ?? 0.4, skip = opts.skip || [];
  const inner = h.map((v) => v - r), q = [0, 0, 0], d = [0, 0, 0];
  for (const [name, [a, s, ua, va]] of Object.entries(FACES)) {
    if (skip.includes(name)) continue;
    const loops = (ax) => opts.loops || (h[ax] > 0.25 ? [0.07, 0.22] : h[ax] > 0.1 ? [0.06] : []);
    const U = rows(h[ua], r, seg, cell, loops(ua)), V = rows(h[va], r, seg, cell, loops(va)), base = m.count;
    for (const v of V) for (const u of U) {
      q[a] = s * h[a]; q[ua] = u; q[va] = v;
      let len = 0;
      for (let i = 0; i < 3; i++) { const c = Math.max(-inner[i], Math.min(inner[i], q[i])); d[i] = q[i] - c; len += d[i] * d[i]; }
      len = Math.sqrt(len);
      const nx = len > 1e-9 ? d[0] / len : 0, ny = len > 1e-9 ? d[1] / len : 0, nz = len > 1e-9 ? d[2] / len : 0;
      const px = r > 0 ? q[0] - d[0] + nx * r : q[0], py = r > 0 ? q[1] - d[1] + ny * r : q[1], pz = r > 0 ? q[2] - d[2] + nz * r : q[2];
      const fn = [0, 0, 0]; fn[a] = s;
      m.v(px + at[0], py + at[1], pz + at[2], r > 0 ? nx : fn[0], r > 0 ? ny : fn[1], r > 0 ? nz : fn[2], u + h[ua], v + h[va]);
    }
    const nu = U.length;
    for (let j = 0; j < V.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a0 = base + j * nu + i; m.quad(a0, a0 + 1, a0 + 1 + nu, a0 + nu);
    }
  }
  return m.geometry();
}

// a flat rectangle facing +z (x from -w/2..w/2, y from -h/2..h/2), divided into steps no longer than `cell`;
// uv runs 0..1 across it unless a rect [u0, v0, u1, v1] is given
export function plane(w, h, opts = {}) {
  const m = new MeshData(), cell = opts.cell ?? 0.4, nx = Math.max(1, Math.ceil(w / cell)), ny = Math.max(1, Math.ceil(h / cell)), [u0, v0, u1, v1] = opts.uv || [0, 0, 1, 1];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) m.v(-w / 2 + w * i / nx, -h / 2 + h * j / ny, 0, 0, 0, 1, u0 + (u1 - u0) * i / nx, v0 + (v1 - v0) * j / ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; m.quad(a, a + 1, a + nx + 2, a + nx + 1); }
  return m.geometry();
}

// ── profiles (closed outlines in their own x, y with outward normals) and paths (points with the profile's frame) ──
// a rounded rectangle w x h centred on (cx, cy), corners radius r in `seg` steps; counter-clockwise
export function rrect(w, h, r = 0.01, seg = 2, cx = 0, cy = 0) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const pts = [], nrm = [], corners = [[w / 2 - r, -h / 2 + r, -Math.PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI]];
  for (const [x, y, a0] of corners) {
    if (r <= 1e-5) { // a hard corner: two points, one for each side's normal
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a0 + Math.PI / 2), s1 = Math.sin(a0 + Math.PI / 2);
      pts.push([cx + x, cy + y]); nrm.push([c0, s0]); pts.push([cx + x, cy + y]); nrm.push([c1, s1]);
      continue;
    }
    for (let k = 0; k <= seg; k++) { const a = a0 + Math.PI / 2 * k / seg, c = Math.cos(a), s = Math.sin(a); pts.push([cx + x + c * r, cy + y + s * r]); nrm.push([c, s]); }
  }
  return { pts, nrm };
}
export function circle(r, n = 16) {
  const pts = [], nrm = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push([c * r, s * r]); nrm.push([c, s]); }
  return { pts, nrm };
}

const V3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));
// a straight path from a to b with the profile's y axis toward `up`, split into steps no longer than `step`
export function line(a, b, up = [0, 1, 0], step = 0.4) {
  const A = V3(a), B = V3(b), t = B.clone().sub(A).normalize(), y = V3(up), out = [];
  y.addScaledVector(t, -y.dot(t)).normalize(); const x = new THREE.Vector3().crossVectors(y, t);
  const n = Math.max(1, Math.ceil(A.distanceTo(B) / step));
  for (let i = 0; i <= n; i++) out.push({ p: A.clone().lerp(B, i / n), x: x.clone(), y: y.clone() });
  return out;
}
// an arch in the x-y plane: up from (-hw, y0) to the springing line `spring`, over a half circle of radius hw (centred on
// x = cx), down to (hw, y0). The profile's x points away from the opening, its y along +z.
export function arch(hw, spring, opts = {}) {
  const y0 = opts.y0 ?? 0, z = opts.z ?? 0, seg = opts.seg ?? 24, step = opts.step ?? 0.3, cx = opts.cx ?? 0, out = [], Y = new THREE.Vector3(0, 0, 1);
  const n = Math.max(1, Math.ceil((spring - y0) / step));
  for (let i = 0; i <= n; i++) out.push({ p: new THREE.Vector3(cx - hw, y0 + (spring - y0) * i / n, z), x: new THREE.Vector3(-1, 0, 0), y: Y.clone() });
  for (let i = 1; i < seg; i++) { const a = Math.PI - Math.PI * i / seg, c = Math.cos(a), s = Math.sin(a); out.push({ p: new THREE.Vector3(cx + c * hw, spring + s * hw, z), x: new THREE.Vector3(c, s, 0), y: Y.clone() }); }
  for (let i = 0; i <= n; i++) out.push({ p: new THREE.Vector3(cx + hw, spring - (spring - y0) * i / n, z), x: new THREE.Vector3(1, 0, 0), y: Y.clone() });
  return out;
}
// a rectangular door frame path (up the left, across the top with rounded corners of radius rc, down the right)
export function doorPath(hw, top, rc = 0.12, opts = {}) {
  const z = opts.z ?? 0, step = opts.step ?? 0.3, seg = opts.seg ?? 6, out = [], Y = new THREE.Vector3(0, 0, 1);
  const up = (x0, y0, x1, y1, nx, ny) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i <= n; i++) out.push({ p: new THREE.Vector3(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, z), x: new THREE.Vector3(nx, ny, 0), y: Y.clone() }); };
  const corner = (cx, cy, a0) => { for (let i = 1; i < seg; i++) { const a = a0 - Math.PI / 2 * i / seg, c = Math.cos(a), s = Math.sin(a); out.push({ p: new THREE.Vector3(cx + c * rc, cy + s * rc, z), x: new THREE.Vector3(c, s, 0), y: Y.clone() }); } };
  up(-hw, 0, -hw, top - rc, -1, 0); corner(-hw + rc, top - rc, Math.PI); up(-hw + rc, top, hw - rc, top, 0, 1); corner(hw - rc, top - rc, Math.PI / 2); up(hw, top - rc, hw, 0, 1, 0);
  return out;
}
// a closed rounded-rectangle loop in the x-y plane (a window frame), profile x outward, y along +z
export function rectLoop(w, h, rc = 0.1, opts = {}) {
  const z = opts.z ?? 0, step = opts.step ?? 0.3, seg = opts.seg ?? 6, cx = opts.cx ?? 0, cy = opts.cy ?? 0, out = [], Y = new THREE.Vector3(0, 0, 1);
  const hw = w / 2, hh = h / 2;
  const side = (x0, y0, x1, y1, nx, ny) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) out.push({ p: new THREE.Vector3(cx + x0 + (x1 - x0) * i / n, cy + y0 + (y1 - y0) * i / n, z), x: new THREE.Vector3(nx, ny, 0), y: Y.clone() }); };
  const corner = (ox, oy, a0) => { for (let i = 0; i < seg; i++) { const a = a0 + Math.PI / 2 * i / seg, c = Math.cos(a), s = Math.sin(a); out.push({ p: new THREE.Vector3(cx + ox + c * rc, cy + oy + s * rc, z), x: new THREE.Vector3(c, s, 0), y: Y.clone() }); } };
  // counter-clockwise from the bottom right corner's end
  corner(hw - rc, -hh + rc, -Math.PI / 2); side(hw, -hh + rc, hw, hh - rc, 1, 0);
  corner(hw - rc, hh - rc, 0); side(hw - rc, hh, -hw + rc, hh, 0, 1);
  corner(-hw + rc, hh - rc, Math.PI / 2); side(-hw, hh - rc, -hw, -hh + rc, -1, 0);
  corner(-hw + rc, -hh + rc, Math.PI); side(-hw + rc, -hh, hw - rc, -hh, 0, -1);
  return out;
}
// a bend: a quarter (or any) arc of radius R about `centre`, in the plane spanned by unit vectors e1 (start direction
// from the centre) and e2, from angle a0 to a1; the profile's y is the plane's normal
export function bend(centre, R, e1, e2, a0, a1, seg = 10) {
  const C = V3(centre), E1 = V3(e1), E2 = V3(e2), N = new THREE.Vector3().crossVectors(E1, E2), out = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * i / seg, rad = E1.clone().multiplyScalar(Math.cos(a)).addScaledVector(E2, Math.sin(a));
    out.push({ p: C.clone().addScaledVector(rad, R), x: rad.clone(), y: N.clone().multiplyScalar(Math.sign(a1 - a0)) });
  }
  return out;
}

// sweep a profile along a path: smooth along both where they are smooth. caps: close the ends with flat discs.
export function sweep(profile, path, opts = {}) {
  const m = new MeshData(), P = profile.pts, N = profile.nrm, np = P.length, closed = opts.closed ?? false, tmp = new THREE.Vector3();
  let along = 0;
  for (let i = 0; i < path.length; i++) {
    const f = path[i]; if (i) along += f.p.distanceTo(path[i - 1].p);
    let arc = 0;
    for (let j = 0; j < np; j++) {
      if (j) arc += Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
      tmp.copy(f.p).addScaledVector(f.x, P[j][0]).addScaledVector(f.y, P[j][1]);
      const nx = f.x.x * N[j][0] + f.y.x * N[j][1], ny = f.x.y * N[j][0] + f.y.y * N[j][1], nz = f.x.z * N[j][0] + f.y.z * N[j][1], l = Math.hypot(nx, ny, nz) || 1;
      m.v(tmp.x, tmp.y, tmp.z, nx / l, ny / l, nz / l, arc, along);
    }
  }
  const rowsN = path.length, last = closed ? rowsN : rowsN - 1;
  // which way round? the path runs along x cross y; a counter-clockwise profile then faces out with (j, j+1, i+1)
  for (let i = 0; i < last; i++) {
    const i1 = (i + 1) % rowsN;
    for (let j = 0; j < np; j++) {
      const j1 = (j + 1) % np, a = i * np + j, b = i * np + j1, c = i1 * np + j1, d = i1 * np + j;
      m.quad(a, b, c, d);
    }
  }
  if (opts.caps && !closed) {
    for (const [i, sgn] of [[0, -1], [rowsN - 1, 1]]) {
      const f = path[i], t = new THREE.Vector3().crossVectors(f.x, f.y).multiplyScalar(sgn), base = m.count;
      let cx = 0, cy = 0; for (const p of P) { cx += p[0]; cy += p[1]; } cx /= np; cy /= np;
      tmp.copy(f.p).addScaledVector(f.x, cx).addScaledVector(f.y, cy); m.v(tmp.x, tmp.y, tmp.z, t.x, t.y, t.z, 0, 0);
      for (let j = 0; j < np; j++) { tmp.copy(f.p).addScaledVector(f.x, P[j][0]).addScaledVector(f.y, P[j][1]); m.v(tmp.x, tmp.y, tmp.z, t.x, t.y, t.z, P[j][0], P[j][1]); }
      for (let j = 0; j < np; j++) { const a = base + 1 + j, b = base + 1 + (j + 1) % np; if (sgn > 0) m.ix.push(base, a, b); else m.ix.push(base, b, a); }
    }
  }
  return fixWinding(m.geometry());
}

// flip the triangles if most of them face against their normals (saves reasoning about every frame's handedness)
export function fixWinding(g) {
  const p = g.attributes.position, n = g.attributes.normal, ix = g.index.array, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3();
  let good = 0, bad = 0;
  for (let t = 0; t < ix.length; t += 3) {
    a.fromBufferAttribute(p, ix[t]); b.fromBufferAttribute(p, ix[t + 1]); c.fromBufferAttribute(p, ix[t + 2]);
    fn.subVectors(b, a).cross(c.sub(a)); if (fn.lengthSq() < 1e-14) continue;
    vn.fromBufferAttribute(n, ix[t]); if (fn.dot(vn) >= 0) good++; else bad++;
  }
  if (bad > good) for (let t = 0; t < ix.length; t += 3) { const s = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s; }
  return g;
}

// an outline (array of [x, y], counter-clockwise) pushed out along +z by `depth` with a rounded edge of radius r;
// creased so curves are smooth and corners stay sharp, and indexed again
export function extrude(outline, depth, r = 0.01, opts = {}) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of opts.holes || []) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, depth - 2 * r), bevelEnabled: r > 0, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: opts.seg ?? 2, curveSegments: opts.curve ?? 12 });   // (the bevel stays inside the outline)
  g.translate(0, 0, r);
  const c = toCreasedNormals(g, opts.crease ?? 0.7); g.dispose();
  c.deleteAttribute('uv'); const uv = new Float32Array(c.attributes.position.count * 2);
  for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = c.attributes.position.getX(i); uv[i * 2 + 1] = c.attributes.position.getY(i); }
  c.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return mergeVertices(c, 1e-5);
}

// a lathe (round things): points [radius, height] from the bottom up, smooth all round
export function lathe(pts, seg = 20) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  return g.index ? g : mergeVertices(g, 1e-6);
}

// a cylinder along y (radius r, height h) centred at `at`, with smooth sides and flat ends
export function cylinder(r, h, at = [0, 0, 0], seg = 16) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1); g.translate(...at); return g;
}

// a convex outline [x, y] made into a flat plate facing +z at depth z (for decals, screens, glows)
export function flat(outline, z = 0, uvRect) {
  const m = new MeshData(), xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), [u0, v0, u1, v1] = uvRect || [0, 0, 1, 1];
  for (const [x, y] of outline) m.v(x, y, z, 0, 0, 1, u0 + (u1 - u0) * (x - x0) / (x1 - x0 || 1), v0 + (v1 - v0) * (y - y0) / (y1 - y0 || 1));
  for (let i = 1; i < outline.length - 1; i++) m.ix.push(0, i, i + 1);
  return m.geometry();
}

// move, turn and scale a geometry in place: at [x, y, z], rot [rx, ry, rz] (radians, XYZ order)
const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _qq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3();
export function put(g, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2]); _qq.setFromEuler(_e); _pp.set(...at); _ss.set(...scale);
  g.applyMatrix4(_m.compose(_pp, _qq, _ss)); return g;
}
