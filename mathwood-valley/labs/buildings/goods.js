// THE STORE'S GOODS: small things whose faces are regions of one picture (art.js STORE_ART: tin labels, sack prints,
// cloth patterns, box labels, heaps of apples seen from above...), built straight into one mesh (one draw for all of
// them). Each shape is a grid of corners in its own frame, moved into place by a matrix:
//
//   box(size, M, faces, tint, o)      a box; faces { '+x': region, ... } (a face left out is not drawn); o.seg [nx, ny,
//                                     nz] corners across each side, o.shape(x, y, z) -> [x, y, z] bends them (a sack)
//   cyl(r, h, M, n, side, top, tint, o)   an n-sided round thing (a tin, a jar's candy, a bolt end on): the side
//                                     region wrapped once round it, the top a disc of its region; o.taper (its top's
//                                     radius, a share of r), o.bottom (draw the bottom too), o.arc ([a0, a1]: only part
//                                     of the way round, the back left out against a wall)
//   dome(r, h, M, n, region, tint)    a heap (apples in a barrel, crackers): a squashed half ball, its region laid on it
//                                     as seen from above
//   lathe(profile, M, n, region, tint, o)   a round thing turned on a lathe: profile [[r, y], ...] in order (its outside
//                                     is on the right walking along it: up the side, out along an underside), n sides;
//                                     the region wrapped once round it (u) and along the profile (v); o.oval [sx, sz]
//                                     squashes it, o.bump(a, y) -> a share to push the corner at angle a, height y out by
//                                     (a sack's sag), o.lift(a, y) -> metres to raise it (a hat's rolled brim), o.flat:
//                                     hard-edged rows (a stove's rings), o.vSpan, o.uSpan (share of the region), o.arc
//                                     [a0, a1]: only that part of the way round (a label on a sack's front), the region
//                                     laid once across it
//   extrude(pts, depth, M, side, cap, tint)   a flat outline [[x, y], ...] (counter-clockwise) drawn out along z: a
//                                     boot's side, the register's arched sign; its faces' corners triangulated
//
// Regions are [x, y, w, h] in the picture's pixels (y down, as drawn). Every corner carries aTintPaint (rgb: a tint over
// the picture), so one region serves many shades. The building's light is baked onto the mesh like any other (aAO,
// aLamp), and lit() reads it.

import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
export class Goods {
  constructor(W = 1024, H = 1024) { this.W = W; this.H = H; this.P = []; this.N = []; this.UV = []; this.C = []; this.I = []; this.n = 0; this.tris = 0; }
  // the u, v of a spot (fu across, fv up, 0..1) in a region, inset a pixel so the smaller copies don't bleed
  uv(reg, fu, fv) { const [x, y, w, h] = reg; return [(x + 1 + fu * (w - 2)) / this.W, 1 - (y + 1 + (1 - fv) * (h - 2)) / this.H]; }
  // a grid of corners: P(i, j) its place (local), Nf(i, j) its normal (local; else worked out from its neighbours),
  // F(i, j) -> [fu, fv] where it falls in the region
  grid(nu, nv, P, F, reg, tint, M, o = {}) {
    _nm.getNormalMatrix(M);
    const pts = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(P(i, j));
    const at = (i, j) => pts[j * (nu + 1) + i];
    const b0 = this.n;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = at(i, j);
      if (o.N) _n.set(...o.N(i, j));
      else {
        const ia = o.wrap ? (i === 0 ? nu - 1 : i - 1) : Math.max(0, i - 1), ib = o.wrap ? (i === nu ? 1 : i + 1) : Math.min(nu, i + 1);
        const ja = Math.max(0, j - 1), jb = Math.min(nv, j + 1), A = at(ia, j), B = at(ib, j), C = at(i, ja), D = at(i, jb);
        const du = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], dv = [D[0] - C[0], D[1] - C[1], D[2] - C[2]];
        _n.set(du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]);
      }
      _n.applyMatrix3(_nm).normalize(); _v.set(p[0], p[1], p[2]).applyMatrix4(M);
      const [fu, fv] = F(i, j), [u, v] = this.uv(reg, fu, fv);
      this.P.push(_v.x, _v.y, _v.z); this.N.push(_n.x, _n.y, _n.z); this.UV.push(u, v); this.C.push(tint[0], tint[1], tint[2], 0);
      this.n++;
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = b0 + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
      this.I.push(a, b, c, a, c, d); this.tris += 2;
    }
  }
  // a flat polygon (its corners in order round it, local, counter-clockwise seen from its front), its region laid on
  // it by planar coordinates (map(p) -> [fu, fv])
  fan(pts, normal, map, reg, tint, M) {
    _nm.getNormalMatrix(M); _n.set(...normal).applyMatrix3(_nm).normalize();
    const b0 = this.n;
    for (const p of pts) { _v.set(...p).applyMatrix4(M); const [u, v] = this.uv(reg, ...map(p)); this.P.push(_v.x, _v.y, _v.z); this.N.push(_n.x, _n.y, _n.z); this.UV.push(u, v); this.C.push(tint[0], tint[1], tint[2], 0); this.n++; }
    for (let i = 1; i < pts.length - 1; i++) { this.I.push(b0, b0 + i, b0 + i + 1); this.tris++; }
  }
  box(size, M, faces, tint = [1, 1, 1], o = {}) {
    const [hx, hy, hz] = size.map((s) => s / 2), seg = o.seg || [1, 1, 1], sh = o.shape || ((x, y, z) => [x, y, z]);
    // each face: its normal axis and sign, which local axes run along u and v (and which way)
    const F = {
      '+z': [[1, 0, 0], [0, 1, 0], [0, 0, 1], seg[0], seg[1]], '-z': [[-1, 0, 0], [0, 1, 0], [0, 0, -1], seg[0], seg[1]],
      '+x': [[0, 0, -1], [0, 1, 0], [1, 0, 0], seg[2], seg[1]], '-x': [[0, 0, 1], [0, 1, 0], [-1, 0, 0], seg[2], seg[1]],
      '+y': [[1, 0, 0], [0, 0, -1], [0, 1, 0], seg[0], seg[2]], '-y': [[1, 0, 0], [0, 0, 1], [0, -1, 0], seg[0], seg[2]],
    };
    const H = [hx, hy, hz];
    for (const key in F) {
      const reg = key in faces ? faces[key] : faces.all; if (!reg) continue;   // (a face named null is left out)
      const [U, V, Nn, nu, nv] = F[key];
      // (the face's corners: its middle out along its normal, then across u and v)
      const P = (i, j) => { const a = (i / nu) * 2 - 1, b = (j / nv) * 2 - 1, p = [0, 1, 2].map((k) => Nn[k] * H[k] + U[k] * a * H[k] * Math.abs(U[k]) + V[k] * b * H[k] * Math.abs(V[k])); return sh(...p); };
      const flat = !o.shape;
      this.grid(nu, nv, P, (i, j) => [i / nu, j / nv], reg, tint, M, flat ? { N: () => Nn } : {});
    }
  }
  cyl(r, h, M, n, side, top, tint = [1, 1, 1], o = {}) {
    const [a0, a1] = o.arc || [0, Math.PI * 2], tp = o.taper ?? 1, full = !o.arc, rows = o.rows || 1;
    const rad = (j) => r * (1 + (tp - 1) * j / rows) * (o.bulge ? 1 + o.bulge * Math.sin(Math.PI * j / rows) : 1);
    const slope = r * (1 - tp) / h;
    if (side) this.grid(n, rows, (i, j) => { const a = a0 + (a1 - a0) * i / n, rr = rad(j); return [Math.sin(a) * rr, -h / 2 + h * j / rows, Math.cos(a) * rr]; },
      (i, j) => [(o.uSpan ?? 1) * i / n, j / rows], side, tint, M, { N: o.bulge ? undefined : (i) => { const a = a0 + (a1 - a0) * i / n; return [Math.sin(a), slope, Math.cos(a)]; }, wrap: full });
    const disc = (y, rr, up, reg) => {
      const pts = []; for (let i = 0; i < n; i++) { const a = (up ? 1 : -1) * (i / n) * Math.PI * 2; pts.push([Math.sin(a) * rr, y, Math.cos(a) * rr]); }
      this.fan(pts, [0, up ? 1 : -1, 0], (p) => [0.5 + 0.5 * p[0] / rr, 0.5 - 0.5 * p[2] / rr], reg, tint, M);
    };
    if (top) disc(h / 2, rad(rows), true, top);
    if (o.bottom) disc(-h / 2, r, false, o.bottom);
  }
  // a flat round (n-sided) face up at y = 0: a lid, a label on a top
  disc(r, M, n, reg, tint = [1, 1, 1]) {
    const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.sin(a) * r, 0, Math.cos(a) * r]); }
    this.fan(pts, [0, 1, 0], (p) => [0.5 + 0.5 * p[0] / r, 0.5 - 0.5 * p[2] / r], reg, tint, M);
  }
  dome(r, h, M, n, reg, tint = [1, 1, 1], rings = 3) {
    // (its rings from the rim up; the top a small flat disc)
    const el = (j) => (j / rings) * Math.PI * 0.46;
    this.grid(n, rings, (i, j) => { const a = (i / n) * Math.PI * 2, e = el(j); return [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * h, Math.cos(a) * Math.cos(e) * r]; },
      (i, j) => { const a = (i / n) * Math.PI * 2, c = Math.cos(el(j)); return [0.5 + 0.5 * Math.sin(a) * c, 0.5 - 0.5 * Math.cos(a) * c]; }, reg, tint, M,
      { N: (i, j) => { const a = (i / n) * Math.PI * 2, e = el(j); return [Math.sin(a) * Math.cos(e) / r, Math.sin(e) / h, Math.cos(a) * Math.cos(e) / r]; }, wrap: true });
    const top = Math.cos(el(rings)), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.sin(a) * top * r, Math.sin(el(rings)) * h, Math.cos(a) * top * r]); }
    this.fan(pts, [0, 1, 0], (p) => [0.5 + 0.5 * p[0] / r, 0.5 - 0.5 * p[2] / r], reg, tint, M);
  }
  lathe(profile, M, n, reg, tint = [1, 1, 1], o = {}) {
    const [sx, sz] = o.oval || [1, 1], m = profile.length - 1, cum = [0];
    for (let j = 1; j <= m; j++) cum.push(cum[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
    // (a radius of 0, a pole, is kept a hair off the axis: there the ring's corners all meet and had no normal to work out)
    const [a0, a1] = o.arc || [0, Math.PI * 2], ang = (i) => a0 + (a1 - a0) * (i / n) + (o.turn || 0);
    const P = (i, j) => { const a = ang(i), y = profile[j][1], r = Math.max(1e-4, profile[j][0]) * (1 + (o.bump ? o.bump(a, y) : 0)); return [Math.sin(a) * r * sx, y + (o.lift ? o.lift(a, y) : 0), Math.cos(a) * r * sz]; };
    if (!o.flat) { this.grid(n, m, P, (i, j) => [(o.uSpan ?? 1) * i / n, (o.vSpan ?? 1) * cum[j] / cum[m]], reg, tint, M, { wrap: !o.arc }); return; }
    // (hard-edged: each ring its own band of corners, so a stove's bands and rims stay crisp)
    for (let j = 0; j < m; j++) this.grid(n, 1, (i, jj) => P(i, j + jj), (i, jj) => [(o.uSpan ?? 1) * i / n, (o.vSpan ?? 1) * cum[j + jj] / cum[m]], reg, tint, M, { wrap: !o.arc });
  }
  extrude(pts, depth, M, side, cap, tint = [1, 1, 1]) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, y]) => new THREE.Vector2(x, y)), []), d = depth / 2;
    if (cap) for (const s of [1, -1]) {
      _nm.getNormalMatrix(M); _n.set(0, 0, s).applyMatrix3(_nm).normalize();
      const b0 = this.n;
      for (const [x, y] of pts) { _v.set(x, y, s * d).applyMatrix4(M); const [u, v] = this.uv(cap, (x - x0) / (x1 - x0 || 1), (y - y0) / (y1 - y0 || 1)); this.P.push(_v.x, _v.y, _v.z); this.N.push(_n.x, _n.y, _n.z); this.UV.push(u, v); this.C.push(tint[0], tint[1], tint[2], 0); this.n++; }
      for (const [a, b, c] of tri) { this.I.push(...(s > 0 ? [b0 + a, b0 + b, b0 + c] : [b0 + a, b0 + c, b0 + b])); this.tris++; }
    }
    if (side) for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, by - ay); if (L < 1e-5) continue;
      const nx = (by - ay) / L, ny = -(bx - ax) / L;
      this.grid(1, 1, (u, v) => [u ? bx : ax, u ? by : ay, v ? d : -d], (u, v) => [u, v], side, tint, M, { N: () => [nx, ny, 0] });
    }
  }
  build() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2)); g.setAttribute('aTintPaint', new THREE.Float32BufferAttribute(this.C, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    return g;
  }
}
