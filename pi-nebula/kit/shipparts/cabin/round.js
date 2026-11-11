// ROUND THINGS for a cabin's machines and pipes. kit/bevel.js draws the faceted things; these are the round ones, in the
// same plain way: each returns a geometry to hand to bevel.js's add.
//   spun(profile, o)     a body turned about +y: profile [[radius, y], ...] going up its outside (and, for a ring, back
//                        down its inside), creased at each of its points (a stepped housing's steps stay sharp), smooth
//                        round. o.seg sides (24), o.caps [first, last] (a flat disc closing that end where it stands
//                        off the axis; both by default). uv: u once round, v 0 at the lowest y to 1 at the highest (or
//                        a point's own third number)
//   tube(points, r, o)   a pipe through points, each corner a real swept bend (o.bend its radius, 2.4 r; o.arc its steps
//                        in a quarter turn, 4), o.seg sides (12), o.caps [start, end] (none by default)
//   ring(R, r, o)        a torus about +y (a handwheel's rim): o.seg round (14), o.sides of its section (6)
//   slab(plan, y0, yOf)  a block on a plan [[x, z], ...] (convex), its foot at y0, its top at yOf(x, z): a top that slopes
//                        over a plan whose corners are cut
//   aim(g, at, axis)     turn a geometry drawn about +y to stand along `axis`, and move it to `at`
//   merged(list)         several geometries as one
// and the fittings made of them, drawn straight into a piece:
//   bolts(p, look, at, axis, R, n, o)  a circle of n hex heads (radius R about `axis` at `at`), standing along +axis
//   flange(p, look, at, axis, r, o)    a collar round a pipe of radius r: o.R (1.5 r), o.w (0.028), o.bolts (how many
//                                      hex heads on its face toward +axis; o.both: on both faces)
//   valve(p, at, axis, r, o)           a valve body on a pipe and a handwheel on a stem: o.stem (the way the stem
//                                      goes, +y), o.look (the wheel's, 'red'), o.body ('gun')
//   clamp(p, at, axis, r, to, o)       a band round a pipe and a strut from it to the point `to` (on a wall, a ceiling)
import * as THREE from 'three';
import { add } from '../../bevel.js';

const PI = Math.PI;
const geo = (P, N, U, I) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(U), 2)); g.setIndex(I);
  return g;
};
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

export function spun(profile, o = {}) {
  const seg = o.seg ?? 24, P = [], N = [], U = [], I = [], ys = profile.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const vOf = (q) => q[2] ?? (y1 > y0 ? (q[1] - y0) / (y1 - y0) : 0);
  const row = (q, nr, ny) => { const b = P.length / 3; for (let i = 0; i <= seg; i++) { const a = i / seg * 2 * PI, c = Math.cos(a), s = Math.sin(a); P.push(c * q[0], q[1], s * q[0]); N.push(c * nr, ny, s * nr); U.push(i / seg, vOf(q)); } return b; };
  for (let k = 0; k < profile.length - 1; k++) {
    const q0 = profile[k], q1 = profile[k + 1], dr = q1[0] - q0[0], dy = q1[1] - q0[1], L = Math.hypot(dr, dy); if (L < 1e-6) continue;
    const A = row(q0, dy / L, -dr / L), B = row(q1, dy / L, -dr / L);
    for (let i = 0; i < seg; i++) I.push(A + i, B + i, B + i + 1, A + i, B + i + 1, A + i + 1);
  }
  const cap = (q, ny) => {
    if (q[0] < 1e-5) return;
    const b = row(q, 0, ny), c = P.length / 3; P.push(0, q[1], 0); N.push(0, ny, 0); U.push(0.5, vOf(q));
    for (let i = 0; i < seg; i++) { if (ny > 0) I.push(c, b + i + 1, b + i); else I.push(c, b + i, b + i + 1); }
  };
  const caps = o.caps ?? [true, true]; if (caps[0]) cap(profile[0], -1); if (caps[1]) cap(profile[profile.length - 1], 1);
  return geo(P, N, U, I);
}

export function tube(points, r, o = {}) {
  // (a point given twice running is one point)
  const seg = o.seg ?? 12, arc = o.arc ?? 4, V = points.map((q) => new THREE.Vector3(...q)).filter((q, i, A) => i === 0 || q.distanceTo(A[i - 1]) > 1e-4), path = [V[0]];
  for (let k = 1; k < V.length - 1; k++) {
    const a = V[k].clone().sub(V[k - 1]), b = V[k + 1].clone().sub(V[k]), la = a.length(), lb = b.length(); a.normalize(); b.normalize();
    const th = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))); if (th < 0.02) continue;
    // (the bend: its radius no more than the two legs allow, its centre off the corner toward the inside)
    const tn = Math.tan(th / 2), R = Math.min(o.bend ?? 2.4 * r, 0.49 * Math.min(la, lb) / tn), n = b.clone().addScaledVector(a, -a.dot(b)).normalize();
    const C = V[k].clone().addScaledVector(a, -R * tn).addScaledVector(n, R), m = Math.max(2, Math.ceil(arc * th / (PI / 2)));
    for (let j = 0; j <= m; j++) { const f = th * j / m; path.push(C.clone().addScaledVector(n, -R * Math.cos(f)).addScaledVector(a, R * Math.sin(f))); }
  }
  path.push(V[V.length - 1]);
  const Q = path.filter((q, i) => i === 0 || q.distanceTo(path[i - 1]) > 1e-5), n = Q.length, P = [], N = [], U = [], I = [], T = [];
  let nv = null, len = 0;
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3(); if (i > 0) t.add(Q[i].clone().sub(Q[i - 1]).normalize()); if (i < n - 1) t.add(Q[i + 1].clone().sub(Q[i]).normalize()); t.normalize(); T.push(t);
    if (!nv) nv = new THREE.Vector3().crossVectors(t, Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(); else nv.addScaledVector(t, -nv.dot(t)).normalize();
    const bv = new THREE.Vector3().crossVectors(t, nv); if (i) len += Q[i].distanceTo(Q[i - 1]);
    for (let j = 0; j <= seg; j++) { const a = j / seg * 2 * PI, c = Math.cos(a), s = Math.sin(a), x = nv.x * c + bv.x * s, y = nv.y * c + bv.y * s, z = nv.z * c + bv.z * s; P.push(Q[i].x + x * r, Q[i].y + y * r, Q[i].z + z * r); N.push(x, y, z); U.push(j / seg, len); }
    if (i) { const A = (i - 1) * (seg + 1), B = i * (seg + 1); for (let j = 0; j < seg; j++) I.push(A + j, B + j + 1, B + j, A + j, A + j + 1, B + j + 1); }
  }
  const cap = (i, sg) => {
    const b = P.length / 3, t = T[i], base = i * (seg + 1);
    for (let j = 0; j <= seg; j++) { P.push(P[(base + j) * 3], P[(base + j) * 3 + 1], P[(base + j) * 3 + 2]); N.push(t.x * sg, t.y * sg, t.z * sg); U.push(j / seg, 0); }
    const c = P.length / 3; P.push(Q[i].x, Q[i].y, Q[i].z); N.push(t.x * sg, t.y * sg, t.z * sg); U.push(0.5, 0);
    for (let j = 0; j < seg; j++) { if (sg > 0) I.push(c, b + j, b + j + 1); else I.push(c, b + j + 1, b + j); }
  };
  if (o.caps?.[0]) cap(0, -1); if (o.caps?.[1]) cap(n - 1, 1);
  return geo(P, N, U, I);
}

export function ring(R, r, o = {}) {
  const sides = o.sides ?? 6, prof = []; for (let k = 0; k <= sides; k++) { const a = k / sides * 2 * PI; prof.push([R + Math.cos(a) * r, Math.sin(a) * r]); }
  return spun(prof, { seg: o.seg ?? 14, caps: [false, false] });
}

export function slab(plan, y0, yOf) {
  const P = [], N = [], U = [], I = [], n = plan.length, top = plan.map(([x, z]) => [x, yOf(x, z), z]), bot = plan.map(([x, z]) => [x, y0, z]);
  const face = (pts) => {
    const b = P.length / 3, [a, c, d] = pts, u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]], nn = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    for (const q of pts) { P.push(...q); N.push(...nn); U.push(q[0], q[2]); }
    for (let i = 1; i < pts.length - 1; i++) I.push(b, b + i, b + i + 1);
  };
  // (the plan given either way round: its sides face out, its top up)
  let area = 0; for (let i = 0; i < n; i++) { const [x0, z0] = plan[i], [x1, z1] = plan[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
  const order = area > 0 ? [...Array(n).keys()].reverse() : [...Array(n).keys()], T = order.map((i) => top[i]), B = order.map((i) => bot[i]);
  face(T); face(B.slice().reverse());
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; face([B[j], T[j], T[i], B[i]]); }
  return geo(P, N, U, I);
}

const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _y = new THREE.Vector3(0, 1, 0), _one = new THREE.Vector3(1, 1, 1);
export function aim(g, at = [0, 0, 0], axis = [0, 1, 0]) {
  _q.setFromUnitVectors(_y, new THREE.Vector3(...axis).normalize()); _m.compose(new THREE.Vector3(...at), _q, _one); g.applyMatrix4(_m);
  return g;
}

export function merged(list) {
  const P = [], N = [], U = [], I = [];
  for (const g of list) {
    const b = P.length / 3, p = g.attributes.position.array, nn = g.attributes.normal.array, u = g.attributes.uv.array, ix = g.index.array;
    for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(nn[i]); } for (let i = 0; i < u.length; i++) U.push(u[i]); for (let i = 0; i < ix.length; i++) I.push(b + ix[i]);
  }
  return geo(P, N, U, I);
}

// ── fittings ────────────────────────────────────────────────────────────────────────────────────────────────────
export function bolts(p, look, at, axis, R, n, o = {}) {
  const s = o.size ?? 0.012, h = o.h ?? 0.01, list = [];
  for (let i = 0; i < n; i++) { const a = (i + (o.turn ?? 0.5)) / n * 2 * PI, g = spun([[s, 0], [s, h]], { seg: 6, caps: [false, true] }); g.translate(Math.cos(a) * R, 0, Math.sin(a) * R); list.push(g); }
  return add(p, look, aim(merged(list), at, axis));
}
export function flange(p, look, at, axis, r, o = {}) {
  const A = unit(axis), R = o.R ?? r * 1.5, w = o.w ?? 0.028;
  add(p, look, aim(spun([[r * 0.97, -w / 2], [R, -w / 2], [R, w / 2], [r * 0.97, w / 2]], { seg: o.seg ?? 12, caps: [false, false] }), at, A));
  if (o.bolts) for (const sg of o.both ? [1, -1] : [1]) bolts(p, o.boltLook || look, at.map((v, k) => v + A[k] * sg * w / 2), A.map((v) => v * sg), (r + R) / 2, o.bolts, { size: Math.min(0.012, (R - r) * 0.3), h: 0.008 });
}
export function valve(p, at, axis, r, o = {}) {
  const A = unit(axis), S = unit(o.stem || [0, 1, 0]), R = r * 1.65, L = r * 3, sh = o.h ?? r * 1.65 + 0.07, wr = o.wheel ?? Math.max(0.05, r * 1.4), body = o.body || 'gun';
  add(p, body, aim(spun([[r * 1.25, -L / 2], [r * 1.25, -L / 2 + 0.014], [R, -L / 4], [R, L / 4], [r * 1.25, L / 2 - 0.014], [r * 1.25, L / 2]], { seg: 10 }), at, A));
  add(p, body, aim(spun([[r * 0.42, 0], [r * 0.42, sh]], { seg: 6, caps: [false, false] }), at, S));
  const wheel = merged([ring(wr, 0.008, { seg: 14, sides: 5 }), spun([[0.016, -0.01], [0.016, 0.012]], { seg: 6 }),
    tube([[-wr, 0, 0], [wr, 0, 0]], 0.0055, { seg: 4 }), tube([[0, 0, -wr], [0, 0, wr]], 0.0055, { seg: 4 })]);
  add(p, o.look || 'red', aim(wheel, at.map((v, k) => v + S[k] * sh), S));
}
export function clamp(p, at, axis, r, to, o = {}) {
  add(p, o.look || 'black', aim(spun([[r + 0.001, -0.014], [r + 0.011, -0.014], [r + 0.011, 0.014], [r + 0.001, 0.014]], { seg: 10, caps: [false, false] }), at, unit(axis)));
  if (to) add(p, o.look || 'black', tube([at, to], 0.011, { seg: 4 }));
}
