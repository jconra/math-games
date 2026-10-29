// THE FIDDLE AND THE BOW, made in code (their numbers: src/fiddleplan.js). An 1880s fiddle at full size: the body with
// its lower and upper bouts and the waist between them, a spruce top lighter than the maple back and ribs under a warm
// brown varnish, darker toward every edge (where the varnish lies thicker and the hands have darkened it); the black
// fingerboard, tailpiece and pegs (ebony), the pale maple bridge, four gut strings, the scroll on its pegbox, and the
// f-holes as dark shapes on the top. The bow: a thin dark stick bent a little toward its pale hair, the black frog at
// its end and the head at its tip. Each is one mesh (its parts merged, coloured by their vertices), and both share one
// material: about 630 triangles for the fiddle, 130 for the bow.
//
//   makeFiddleModel({ wear, material }) -> THREE.Mesh   in the fiddle's own frame (src/fiddleplan.js): the end button
//   makeBowModel({ wear, material }) -> THREE.Mesh      at the origin, the scroll along +x; the bow's screw end at the
//                                                      origin, its tip along +x, the stick above the hair (+y)
//   fiddleGeometry({ wear }), bowGeometry({ wear })     their geometry alone (for a props page, the clip script's look)
//   fiddleMaterial()                                    the shared material (a new one each call)
//   FIDDLE_PROPS        what a props list needs to show them: id, name, category, size, triangles
//   wear: 0 (bright varnish) .. 1 (an old fiddle: the varnish darker and duller)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIDDLE, BOW, halfWidth, topY, backY, stringAt } from './fiddleplan.js';

// period colours (sRGB, as a picker shows them)
const C = {
  top: '#a46d38', topEdge: '#45240f',         // spruce under an amber-brown varnish; darker to the edge
  back: '#86491f', backEdge: '#3a1e0c',       // the maple back, a deeper brown
  rib: '#74401d', ribLow: '#4c2911',
  neck: '#7e4a24', scroll: '#6e3f1e',
  ebony: '#1b1613', hollow: '#140d08',
  bridge: '#cdb58c', gut: '#d3c39c', fhole: '#1a0f08',
  stick: '#3e2416', hair: '#ddd6c4', frog: '#17120f', tip: '#d4cab2', button: '#2c241e',
};
export const FIDDLE_PROPS = [
  { id: 'fiddle', name: 'Fiddle', category: 'Music', size: [0.59, 0.075, 0.206], tris: 632, make: 'makeFiddleModel' },
  { id: 'bow', name: 'Fiddle bow', category: 'Music', size: [0.762, 0.026, 0.012], tris: 128, make: 'makeBowModel' },
];

const col = new THREE.Color();
function colourOf(hex, wear) {
  col.set(hex);   // (read as sRGB, kept in three's linear working space)
  const k = 1 - 0.22 * wear;
  return [col.r * k, col.g * k * 0.98, col.b * k * 0.95];
}
// a part from points and triangles (indexed), its normals smooth across it, then loose triangles to merge
function part(pos, tris, cols, { smooth = true } = {}) {
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.flat(), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols.flat(), 3));
  g.setIndex(tris.flat());
  if (smooth) g.computeVertexNormals();
  g = g.toNonIndexed();
  if (!smooth) g.computeVertexNormals();
  return g;
}
// a hexahedron from its eight corners (the four of its -x end, then its +x end, each round as -y-z, -y+z, +y+z, +y-z),
// flat-faced, one colour (or a colour for its +y face: top)
function hexa(P, colour, { top = null } = {}) {
  const F = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  const pos = [], cols = [], tris = [];
  for (const f of F) {
    const b = pos.length, isTop = top && f.every((i) => i === 2 || i === 3 || i === 6 || i === 7);
    for (const i of f) { pos.push(P[i]); cols.push(isTop ? top : colour); }
    tris.push([b, b + 1, b + 2], [b, b + 2, b + 3]);
  }
  return outward(part(pos, tris, cols, { smooth: false }));
}
// (each face turned to face away from the part's middle: the corners' order then doesn't matter)
function outward(g) {
  const p = g.attributes.position, m = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) m.add(a.fromBufferAttribute(p, i)); m.multiplyScalar(1 / p.count);
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b));
    if (n.dot(a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(m)) < 0) swap(g, i + 1, i + 2);
  }
  g.computeVertexNormals();
  return g;
}
function swap(g, i, j) {
  for (const name of Object.keys(g.attributes)) {
    const A = g.attributes[name], s = A.itemSize;
    for (let k = 0; k < s; k++) { const t = A.array[i * s + k]; A.array[i * s + k] = A.array[j * s + k]; A.array[j * s + k] = t; }
  }
}
// an axis-aligned box (min, max corners)
const box = (lo, hi, colour, opts) => hexa([[lo[0], lo[1], lo[2]], [lo[0], lo[1], hi[2]], [lo[0], hi[1], hi[2]], [lo[0], hi[1], lo[2]],
  [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [hi[0], hi[1], hi[2]], [hi[0], hi[1], lo[2]]], colour, opts);
// a flat ribbon over a curve: pts [[x, y, z]], half widths, lifted along y; facing +y
function ribbon(pts, half, colour) {
  const pos = [], cols = [], tris = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)];
    let dx = q[0] - r[0], dz = q[2] - r[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz, nz = dx, h = half[i];
    pos.push([p[0] - nx * h, p[1], p[2] - nz * h], [p[0] + nx * h, p[1], p[2] + nz * h]); cols.push(colour, colour);
  });
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; tris.push([a, a + 2, a + 1], [a + 1, a + 2, a + 3]); }
  const g = part(pos, tris, cols, { smooth: false });
  // (all facing up)
  const p = g.attributes.position, A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); Cc.fromBufferAttribute(p, i + 2);
    if (Cc.clone().sub(B).cross(A.clone().sub(B)).y < 0) swap(g, i + 1, i + 2);
  }
  g.computeVertexNormals();
  return g;
}
// a prism round an axis (x or z): n sides, each station [centre, radius, colour?]; its faces turned out from the axis
// (the corners go round from +y toward +z about x, from +x toward +y about z), caps on its ends if asked
function tube(stations, n, colour, { axis = 'x', caps = false } = {}) {
  const pos = [], cols = [], tris = [];
  for (const [c, r, colr] of stations) for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 + Math.PI / n, u = Math.cos(a) * r, v = Math.sin(a) * r;
    pos.push(axis === 'x' ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2]]); cols.push(colr || colour);
  }
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n;
    tris.push([a, b, c], [b, d, c]);
  }
  if (caps) {
    const e = (stations.length - 1) * n;
    for (let j = 1; j < n - 1; j++) tris.push([0, j + 1, j], [e, e + j, e + j + 1]);
  }
  return part(pos, tris, cols);
}
const lerp = (a, b, u) => a + (b - a) * u;
const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

// the fingerboard's top at x
const fbTop = (x) => { const F = FIDDLE.fingerboard, a = stringAt(1, F.from)[1] - 0.0045, b = FIDDLE.strings.nut.y[0] - 0.001; return lerp(a, b, (x - F.from) / (F.to - F.from)); };

export function fiddleGeometry({ wear = 0.2 } = {}) {
  const c = (k) => colourOf(C[k], wear), parts = [];
  const O = FIDDLE.outline;
  // THE TOP: a grid over the outline, arched, lighter in the middle and darker to its edges and ends
  const UT = [-1, -0.85, -0.42, 0.42, 0.85, 1], UB = [-1, -0.5, 0.5, 1];
  const plate = (U, yOf, mid, edge, down) => {
    const pos = [], cols = [], tris = [], n = U.length;
    O.forEach(([x, w]) => U.forEach((u) => {
      pos.push([x, yOf(x, u), u * w]);
      const e = Math.pow(Math.abs(u), 2.2) * 0.85 + 0.35 * Math.pow(Math.abs(x / FIDDLE.body - 0.5) * 2, 4);
      cols.push(mix3(mid, edge, Math.min(1, e)));
    }));
    for (let i = 0; i < O.length - 1; i++) for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + 1, d = a + n, e = d + 1;
      tris.push(down ? [a, d, b] : [a, b, d], down ? [b, d, e] : [b, e, d]);
    }
    return part(pos, tris, cols);
  };
  parts.push(plate(UT, topY, c('top'), c('topEdge'), false), plate(UB, backY, c('back'), c('backEdge'), true));
  // THE RIBS: a band round the outline, from the top's edge down to the back's
  {
    const ring = [...O.map(([x, w]) => [x, w]), ...O.slice().reverse().map(([x, w]) => [x, -w])];
    const pos = [], cols = [], tris = [];
    ring.forEach(([x, z]) => { pos.push([x, 0, z], [x, -FIDDLE.ribs, z]); cols.push(c('rib'), c('ribLow')); });
    for (let i = 0; i < ring.length; i++) {
      const a = i * 2, b = ((i + 1) % ring.length) * 2;
      tris.push([a, b, a + 1], [b, b + 1, a + 1]);
    }
    const g = part(pos, tris, cols);
    // (facing out from the body's middle line)
    const p = g.attributes.position, A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); Cc.fromBufferAttribute(p, i + 2);
      const n = Cc.clone().sub(B).cross(A.clone().sub(B)), m = A.clone().add(B).add(Cc).multiplyScalar(1 / 3);
      const out = new THREE.Vector3(m.x < 0.01 ? -1 : m.x > FIDDLE.body - 0.01 ? 1 : 0, 0, Math.abs(m.x - FIDDLE.body / 2) > FIDDLE.body / 2 - 0.01 ? 0 : Math.sign(m.z));
      if (n.dot(out) < 0) swap(g, i + 1, i + 2);
    }
    g.computeVertexNormals();
    parts.push(g);
  }
  // THE F-HOLES: an S down each side of the bridge, its eyes wider (dark, just over the top)
  const F = [[0.2, 0.024, 0.0032], [0.19, 0.0272, 0.0013], [0.175, 0.0308, 0.0012], [0.16, 0.0338, 0.0016], [0.145, 0.0372, 0.0012], [0.132, 0.0408, 0.0013], [0.122, 0.043, 0.0036]];
  for (const s of [-1, 1]) {
    const pts = F.map(([x, z]) => [x, topY(x, (s * z) / halfWidth(x)) + 0.0012, s * z]);
    parts.push(ribbon(pts, F.map((f) => f[2]), c('fhole')));
  }
  // THE NECK under the fingerboard (rounded under), its heel down to the back's button at the body's end
  {
    const st = [0.352, 0.42, FIDDLE.fingerboard.to].map((x) => {
      const hw = lerp(FIDDLE.fingerboard.w0, FIDDLE.fingerboard.w1, (x - FIDDLE.fingerboard.from) / (FIDDLE.fingerboard.to - FIDDLE.fingerboard.from)) / 2 * 0.94;
      const yt = fbTop(x) - FIDDLE.fingerboard.t, yb = fbTop(x) - lerp(0.023, 0.0195, (x - 0.352) / 0.135);
      return [[x, yt, -hw], [x, yt - 0.005, -hw], [x, yb + 0.003, -hw * 0.55], [x, yb, 0], [x, yb + 0.003, hw * 0.55], [x, yt - 0.005, hw], [x, yt, hw]];
    });
    const pos = [], cols = [], tris = [];
    st.forEach((ring) => ring.forEach((p) => { pos.push(p); cols.push(c('neck')); }));
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < 6; j++) { const a = i * 7 + j; tris.push([a, a + 7, a + 1], [a + 1, a + 7, a + 8]); }
    const g = part(pos, tris, cols);
    const p = g.attributes.position, A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); Cc.fromBufferAttribute(p, i + 2);
      const n = Cc.clone().sub(B).cross(A.clone().sub(B)), m = A.clone().add(B).add(Cc).multiplyScalar(1 / 3);
      if (n.dot(new THREE.Vector3(0, m.y - (fbTop(m.x) - 0.012), m.z)) < 0) swap(g, i + 1, i + 2);
    }
    g.computeVertexNormals(); parts.push(g);
    const hw = FIDDLE.fingerboard.w0 * 0.42;
    parts.push(hexa([[0.338, -FIDDLE.ribs - 0.004, -hw * 0.7], [0.338, -FIDDLE.ribs - 0.004, hw * 0.7], [0.338, fbTop(0.338) - 0.006, hw], [0.338, fbTop(0.338) - 0.006, -hw],
      [0.372, -0.012, -hw * 0.75], [0.372, -0.012, hw * 0.75], [0.372, fbTop(0.372) - 0.006, hw], [0.372, fbTop(0.372) - 0.006, -hw]], c('neck')));
  }
  // THE FINGERBOARD: ebony, from over the body up to the nut, widening toward the body
  {
    const Fb = FIDDLE.fingerboard, a = Fb.from, b = Fb.to, t = Fb.t;
    parts.push(hexa([[a, fbTop(a) - t, -Fb.w0 / 2], [a, fbTop(a) - t, Fb.w0 / 2], [a, fbTop(a), Fb.w0 / 2], [a, fbTop(a), -Fb.w0 / 2],
      [b, fbTop(b) - t, -Fb.w1 / 2], [b, fbTop(b) - t, Fb.w1 / 2], [b, fbTop(b), Fb.w1 / 2], [b, fbTop(b), -Fb.w1 / 2]], c('ebony')));
  }
  // THE PEGBOX (dark inside its open top), the scroll at its end, two pegs out of each side
  {
    const P = FIDDLE.pegbox, hw = P.w / 2, ya = 0.012, yb = 0.001, h = P.h / 2;
    parts.push(hexa([[P.from, ya - h, -hw], [P.from, ya - h, hw], [P.from, ya + h, hw], [P.from, ya + h, -hw],
      [P.to, yb - h, -hw * 0.9], [P.to, yb - h, hw * 0.9], [P.to, yb + h, hw * 0.9], [P.to, yb + h, -hw * 0.9]], c('scroll'), { top: c('hollow') }));
    // (the scroll: a disc on edge, each face darker toward its middle, the volute's eye)
    const S = FIDDLE.scroll, sy = yb + 0.002, pos = [], cols = [], tris = [], n = 8;
    for (const z of [-S.w / 2, S.w / 2]) for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; pos.push([S.x + Math.cos(a) * S.r, sy + Math.sin(a) * S.r, z]); cols.push(c('scroll')); }
    pos.push([S.x, sy, -S.w / 2 - 0.002], [S.x, sy, S.w / 2 + 0.002]); cols.push(c('hollow'), c('hollow'));
    for (let j = 0; j < n; j++) { const k = (j + 1) % n; tris.push([j, k, n + j], [k, n + k, n + j], [2 * n, k, j], [2 * n + 1, n + j, n + k]); }
    parts.push(outward(part(pos, tris, cols)));
    FIDDLE.pegs.forEach((x, i) => {
      const s = i % 2 ? -1 : 1, y = lerp(ya, yb, (x - P.from) / (P.to - P.from));
      parts.push(box([x - 0.002, y - 0.002, s > 0 ? hw : -0.032], [x + 0.002, y + 0.002, s > 0 ? 0.032 : -hw], c('ebony')));
      parts.push(box([x - 0.007, y - 0.0085, s > 0 ? 0.031 : -0.036], [x + 0.007, y + 0.0085, s > 0 ? 0.036 : -0.031], c('ebony')));
    });
  }
  // THE TAILPIECE (ebony, rising from the end of the body toward the bridge) and the end button
  {
    const T = FIDDLE.tailpiece;
    parts.push(hexa([[T.from, T.y0 - T.t, -T.w0 / 2], [T.from, T.y0 - T.t, T.w0 / 2], [T.from, T.y0, T.w0 / 2], [T.from, T.y0, -T.w0 / 2],
      [T.to, T.y1 - T.t, -T.w1 / 2], [T.to, T.y1 - T.t, T.w1 / 2], [T.to, T.y1, T.w1 / 2], [T.to, T.y1, -T.w1 / 2]], c('ebony')));
    parts.push(box([-0.006, -0.021, -0.0042], [0.001, -0.01, 0.0042], c('ebony')));
  }
  // THE BRIDGE: pale maple, its feet on the top, its arched top under the strings
  {
    const B = FIDDLE.bridge, x0 = B.x - B.t / 2, x1 = B.x + B.t / 2, hw = B.w / 2;
    const foot = (z) => topY(B.x, z / halfWidth(B.x)) - 0.0005;
    const prof = [[-hw, foot(-hw)], [-hw * 0.92, 0.031], [-hw * 0.82, FIDDLE.strings.bridge.y[0] - 0.0012], [0, FIDDLE.strings.bridge.y[1] - 0.0008],
      [hw * 0.82, FIDDLE.strings.bridge.y[3] - 0.0012], [hw * 0.92, 0.031], [hw, foot(hw)]];
    const pos = [], cols = [], tris = [], n = prof.length;
    for (const x of [x0, x1]) for (const [z, y] of prof) { pos.push([x, y, z]); cols.push(c('bridge')); }
    for (let j = 1; j < n - 1; j++) { tris.push([0, j, j + 1], [n, n + j + 1, n + j]); }
    for (let j = 0; j < n; j++) { const k = (j + 1) % n; tris.push([j, n + j, k], [k, n + j, n + k]); }
    parts.push(outward(part(pos, tris, cols, { smooth: false })));
  }
  // THE STRINGS: gut, from the tailpiece over the bridge to the nut (flat ribbons facing up)
  for (let k = 0; k < 4; k++) {
    const pts = [stringAt(k, FIDDLE.strings.tail.x), stringAt(k, FIDDLE.bridge.x), stringAt(k, FIDDLE.nut)];
    const hw = [0.00068, 0.0006, 0.00055, 0.00048][k];
    parts.push(ribbon(pts, [hw, hw, hw], c('gut')));
  }
  const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
  geo.computeBoundingSphere();
  return geo;
}

export function bowGeometry({ wear = 0.2 } = {}) {
  const c = (k) => colourOf(C[k], wear), parts = [], L = BOW.length;
  // THE STICK: six-sided, thinning to the tip, bent toward the hair in its middle
  const xs = [0.018, 0.13, 0.25, 0.375, 0.5, 0.62, 0.735];
  parts.push(tube(xs.map((x) => [[x, -BOW.camber * Math.sin(Math.PI * x / L), 0], lerp(BOW.r0, BOW.r1, x / L)]), 6, c('stick')));
  // the button at its end, the frog under the stick, the hair, the head at the tip (its face pale)
  parts.push(tube([[[-0.012, 0, 0], 0.0047], [[0.018, 0, 0], 0.0047]], 6, c('button'), { caps: true }));
  const F = BOW.frog, H = BOW.hair;
  parts.push(hexa([[F.from, F.low, -0.0062], [F.from, F.low, 0.0062], [F.from, -0.0025, 0.0062], [F.from, -0.0025, -0.0062],
    [F.to, H.y - H.t - 0.001, -0.0062], [F.to, H.y - H.t - 0.001, 0.0062], [F.to, -0.0028, 0.0062], [F.to, -0.0028, -0.0062]], c('frog')));
  parts.push(box([H.from, H.y - H.t, -H.w / 2], [H.to, H.y, H.w / 2], c('hair')));
  const T = BOW.head;
  parts.push(hexa([[T.from, H.y - H.t - 0.001, -0.0034], [T.from, H.y - H.t - 0.001, 0.0034], [T.from, 0.0026, 0.0034], [T.from, 0.0026, -0.0034],
    [T.to, H.y - H.t + 0.004, -0.003], [T.to, H.y - H.t + 0.004, 0.003], [T.to - 0.004, 0.0028, 0.003], [T.to - 0.004, 0.0028, -0.003]], c('stick')));
  parts.push(box([T.to - 0.0012, H.y - H.t + 0.004, -0.0029], [T.to + 0.0006, 0.0005, 0.0029], c('tip')));
  const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
  geo.computeBoundingSphere();
  return geo;
}

export function fiddleMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0 });
}
export function makeFiddleModel({ wear = 0.2, material = null } = {}) {
  const m = new THREE.Mesh(fiddleGeometry({ wear }), material || fiddleMaterial()); m.name = 'fiddle';
  return m;
}
export function makeBowModel({ wear = 0.2, material = null } = {}) {
  const m = new THREE.Mesh(bowGeometry({ wear }), material || fiddleMaterial()); m.name = 'fiddle bow';
  return m;
}
