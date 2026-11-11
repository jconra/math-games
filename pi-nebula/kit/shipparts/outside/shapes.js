// SHAPES the outside parts share: a lathe about the z axis that can be faceted (an octagonal engine drum, as in the
// game's maker's pictures) or round, with a surface (or a glow) per band; and a box drawn into the same collector.
//   latheZ(acc, prof, n, paint, opts)  prof [[radius, z], ...] traced from the front on the axis, out, back along the
//       outside, and in again at the back (so each band faces out of the solid); n sides; paint(i) the surface of
//       band i, or { glow: [r, g, b] } for a glowing band; opts.flat (default n <= 12) flat facets, else smooth;
//       opts.phase turns it (radians; an octagon sits flat-bottomed at PI / n)
//   box(acc, surf, [x0, x1], [y0, y1], [z0, z1])   a plain box (no bevels: small details)
import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
export function latheZ(acc, prof, n, paint, opts = {}) {
  const flat = opts.flat ?? n <= 12, ph = opts.phase ?? (n <= 12 ? Math.PI / n : 0), at = opts.at || [0, 0, 0], ax = opts.axis || 'z';
  // (about z; or about y or x, the profile's "z" then running along that axis)
  const sw = (x, y, z) => (ax === 'y' ? v(y, z, x) : ax === 'x' ? v(z, x, y) : v(x, y, z));
  const P = (r, a, z) => sw(r * Math.cos(a), r * Math.sin(a), z).add(v(...at));
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, z0] = prof[i], [r1, z1] = prof[i + 1], dr = r1 - r0, dz = z1 - z0;
    if (Math.abs(dr) < 1e-9 && Math.abs(dz) < 1e-9) continue;
    const look = paint(i), mat = look?.glow ? 'glow' : 'solid', surf = look?.glow || look, nr = -dz, nz = dr;   // (the band's normal in (radius, z))
    for (let k = 0; k < n; k++) {
      const a0 = ph + k / n * Math.PI * 2, a1 = ph + (k + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
      const quad = [P(r0, a0, z0), P(r0, a1, z0), P(r1, a1, z1), P(r1, a0, z1)];
      if (flat || mat === 'glow') {
        const out = sw(nr * Math.cos(am), nr * Math.sin(am), nz).normalize();
        const pts = quad.filter((q, j) => quad.findIndex((w) => w.distanceTo(q) < 1e-7) === j);
        if (pts.length >= 3) acc.poly(orientTo(pts, out), out, surf, mat, 9);
      } else {
        // (round: smooth across the sides, one normal per corner)
        const m = acc.mesh(surf, mat), base = m.count, nl = Math.hypot(nr, nz) || 1;
        for (const [q, a] of [[quad[0], a0], [quad[1], a1], [quad[2], a1], [quad[3], a0]]) { const N = sw(nr / nl * Math.cos(a), nr / nl * Math.sin(a), nz / nl); m.v(q.x, q.y, q.z, N.x, N.y, N.z, a, q.z); }
        // (each triangle wound to face the band's way; a band that starts or ends on the axis is one triangle)
        const want = sw(nr * Math.cos(am), nr * Math.sin(am), nz);
        const tri = (a, b, c) => { const A = quad[a - base], B = quad[b - base], C = quad[c - base], fn = B.clone().sub(A).cross(C.clone().sub(A)); if (fn.lengthSq() < 1e-14) return; if (fn.dot(want) >= 0) m.ix.push(a, b, c); else m.ix.push(a, c, b); };
        if (r0 < 1e-9) tri(base, base + 2, base + 3);
        else if (r1 < 1e-9) tri(base, base + 1, base + 2);
        else { tri(base, base + 1, base + 2); tri(base, base + 2, base + 3); }
      }
    }
  }
}
function orientTo(pts, out) {
  const n = v(0, 0, 0);
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
  return n.dot(out) < 0 ? pts.slice().reverse() : pts;
}
export function box(acc, surf, [x0, x1], [y0, y1], [z0, z1], mat = 'solid') {
  const c = (x, y, z) => v(x, y, z);
  const faces = [
    [[c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)], v(1, 0, 0)], [[c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1), c(x0, y1, z0)], v(-1, 0, 0)],
    [[c(x0, y1, z0), c(x0, y1, z1), c(x1, y1, z1), c(x1, y1, z0)], v(0, 1, 0)], [[c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], v(0, -1, 0)],
    [[c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)], v(0, 0, 1)], [[c(x0, y0, z0), c(x0, y1, z0), c(x1, y1, z0), c(x1, y0, z0)], v(0, 0, -1)],
  ];
  for (const [q, n] of faces) acc.poly(orientTo(q, n), n, surf, mat, 9);
}
export { orientTo };
// everything in collector `sub` moved by matrix M (a Matrix4: turned, moved, even mirrored) into collector `acc`
export function putAcc(acc, sub, M) {
  const N = new THREE.Matrix3().getNormalMatrix(M), flip = M.determinant() < 0, P = v(0, 0, 0), Q = v(0, 0, 0);
  for (const e of sub.by.values()) {
    const g = e.m, m = acc.mesh(e.surf, e.mat), base = m.count;
    for (let i = 0; i < g.p.length; i += 3) {
      P.set(g.p[i], g.p[i + 1], g.p[i + 2]).applyMatrix4(M); Q.set(g.n[i], g.n[i + 1], g.n[i + 2]).applyMatrix3(N).normalize();
      m.p.push(P.x, P.y, P.z); m.n.push(Q.x, Q.y, Q.z);
    }
    m.uv.push(...g.uv);
    for (let i = 0; i < g.ix.length; i += 3) m.ix.push(base + g.ix[i], base + g.ix[flip ? i + 2 : i + 1], base + g.ix[flip ? i + 1 : i + 2]);
  }
  sub.by.clear();
}
// a bar (a box w wide, d deep) from point a to point b (each [x, y, z]), its width kept level
export function bar(acc, surf, a, b, w, d) {
  const A = v(...a), B = v(...b), L = A.distanceTo(B), q = new (acc.constructor)(); box(q, surf, [-w / 2, w / 2], [0, L], [-d / 2, d / 2]);
  const yAx = B.clone().sub(A).normalize(), xAx = Math.abs(yAx.y) > 0.99 ? v(1, 0, 0) : v(0, 1, 0).cross(yAx).normalize(), zAx = xAx.clone().cross(yAx);
  putAcc(acc, q, new THREE.Matrix4().makeBasis(xAx, yAx, zAx).setPosition(A));
}
