// A STAND-IN SHIP: a small shuttle built in code to park in the hangar until the ship work makes real ones. Its nose
// faces +z, its middle over the origin, on its landing gear: 11 m long, 9 m across the wings, 5 m to the top of the
// fin. The door is on its left side (-x): a boxed hatch with its sill at 1.26 m (seven steps), where a boarding stair
// meets it (DOOR, below, says where).
//   The hull is a loft: rounded cross-sections (superellipses) along its length, in bands of paint (pale above, a
//   charcoal band with lit cabin windows, an orange stripe, grey below), each band sharing the same surface so the
//   bands meet without a seam. A dark canopy over the nose, short wings with two engines, a fin, three legs.
import * as THREE from 'three';
import { MeshData, rrect, circle, put, fixWinding } from './geo.js';
import { DOOR_SILL } from './hangar.js';

const PI = Math.PI;
const CANOPY = { c: '#0d141c', r: 0.08, m: 0.75, w: 0.1 }, HULL = { c: '#c4c6c3', r: 0.42, m: 0.1, w: 0.25 }, BELLY = { c: '#7d8288', r: 0.5, m: 0.3, w: 0.35 };
export const DOOR = { z: 2.45, sill: DOOR_SILL, w: 0.9, h: 1.72 };   // the door: its middle along z (ahead of the wing), its sill, its size

// the hull's shape along its length: [z, half-width, half-height, middle height]
const ST = [[-6.2, 0.12, 0.1, 2.43], [-6.0, 0.36, 0.28, 2.41], [-5.75, 0.6, 0.46, 2.38], [-5.4, 0.86, 0.66, 2.35], [-5.0, 1.08, 0.86, 2.32], [-4.0, 1.36, 1.1, 2.27], [-2.5, 1.52, 1.27, 2.22], [0, 1.56, 1.31, 2.2], [2.0, 1.52, 1.28, 2.18], [3.4, 1.38, 1.12, 2.12], [4.5, 1.06, 0.84, 2.04], [5.2, 0.62, 0.5, 1.98], [5.62, 0.16, 0.14, 1.95], [5.7, 0.01, 0.01, 1.95]];
const NPOW = 2.7;
function cr(v0, v1, v2, v3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3); }
// the section at z: [half-width, half-height, middle]
function section(z) {
  let i = 0; while (i < ST.length - 2 && ST[i + 1][0] < z) i++;
  const a = ST[Math.max(0, i - 1)], b = ST[i], c = ST[i + 1], d = ST[Math.min(ST.length - 1, i + 2)], t = Math.max(0, Math.min(1, (z - b[0]) / (c[0] - b[0])));
  return [1, 2, 3].map((k) => cr(a[k], b[k], c[k], d[k], t));
}
// a point on the hull at angle t round it (0 = the right side, PI/2 = the top) and z along it, pushed out by `out`
function hullAt(t, z, out = 0) {
  const [a, b, yc] = section(z), c = Math.cos(t), s = Math.sin(t), e = 2 / NPOW;
  const x = a * Math.sign(c) * Math.pow(Math.abs(c), e), y = b * Math.sign(s) * Math.pow(Math.abs(s), e);
  const P = new THREE.Vector3(x, yc + y, z);
  if (!out) return P;
  return P.add(hullNormal(t, z).multiplyScalar(out));
}
function hullNormal(t, z) {
  const e = 1e-3, p0 = hullAt(t - e, z), p1 = hullAt(t + e, z), q0 = hullAt(t, z - e), q1 = hullAt(t, z + e);
  return new THREE.Vector3().crossVectors(p1.sub(p0), q1.sub(q0)).normalize();   // (outward: round the hull, then along it)
}
// a band of the hull: angles t0..t1 (nt steps), z0..z1 (nz steps)
function band(p, surf, t0, t1, nt, z0, z1, nz, out = 0) {
  const m = new MeshData();
  for (let j = 0; j <= nz; j++) {
    const z = z0 + (z1 - z0) * j / nz;
    for (let i = 0; i <= nt; i++) { const t = t0 + (t1 - t0) * i / nt, P = hullAt(t, z, out), N = hullNormal(t, z); if (!isFinite(N.x)) N.set(0, 0, 1); m.v(P.x, P.y, P.z, N.x, N.y, N.z); }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nt; i++) { const a = j * (nt + 1) + i; m.quad(a, a + 1, a + nt + 2, a + nt + 1); }
  return p.add('solid', fixWinding(m.geometry()), surf);
}
// something laid on the hull at angle t, z: a box `size` (its z along the hull, its y across the band) turned to sit
// flat on the surface
function onHull(p, surf, size, t, z, out = 0, mat = 'solid') {
  const P = hullAt(t, z, out + size[2] / 2), N = hullNormal(t, z), Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3().crossVectors(N, Z).normalize();
  const M = new THREE.Matrix4().makeBasis(Z, X, N).setPosition(P), g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  g.applyMatrix4(M); return mat === 'solid' ? p.add('solid', g, surf) : p.add(mat, g, surf);
}

export function ship(p) {
  const Z0 = ST[0][0], Z1 = 5.7, NZ = 46;
  // the hull's bands, right side round over the top to the left: grey belly, orange stripe, charcoal window band, pale
  // top, and the same down the left
  const bands = [[-0.5 * PI, 0.06 * PI, BELLY], [0.06 * PI, 0.1 * PI, 'orange'], [0.1 * PI, 0.24 * PI, 'black'], [0.24 * PI, 0.76 * PI, HULL], [0.76 * PI, 0.9 * PI, 'black'], [0.9 * PI, 0.94 * PI, 'orange'], [0.94 * PI, 1.5 * PI, BELLY]];
  for (const [t0, t1, s] of bands) band(p, s, t0, t1, Math.max(3, Math.round((t1 - t0) / (PI / 24))), Z0, Z1, NZ);
  // the tail's tip: a small gunmetal cap in a charcoal rim, a red light on top, two little vents
  { const m = new MeshData(), N = 36; m.v(0, ST[0][3], Z0 - 0.001, 0, 0, -1); for (let i = 0; i <= N; i++) { const P = hullAt(i / N * PI * 2, Z0); m.v(P.x, P.y, Z0 - 0.001, 0, 0, -1); } for (let i = 1; i <= N; i++) m.ix.push(0, i, i + 1); p.add('solid', fixWinding(m.geometry()), 'gun');
    const ring = []; for (let i = 0; i <= N; i++) { const t = i / N * PI * 2, P = hullAt(t, Z0), c = Math.cos(t), sn = Math.sin(t); ring.push({ p: P, x: new THREE.Vector3(c, sn, 0), y: new THREE.Vector3(0, 0, -1) }); }
    p.sweep('black', rrect(0.05, 0.06, 0.012, 2, -0.01, 0.01), ring, { closed: true });
    // (the tail comes almost to a point; its light sits on top of the tail cone, a vent each side of it)
    onHull(p, 'black', [0.16, 0.1, 0.04], 0.5 * PI, -5.7, 0.004); onHull(p, 'red', [0.11, 0.06, 0.01], 0.5 * PI, -5.7, 0.044, 'glow');
    for (const t of [0.05 * PI, 0.95 * PI]) onHull(p, 'dark', [0.3, 0.12, 0.02], t, -5.55, 0.002); }
  // the canopy over the nose: a dark glossy band standing just off the hull, a charcoal frame line round it
  // (a wraparound canopy: dark glass from shoulder to shoulder over the nose, its frame in thin charcoal lines that
  // follow the hull: down each side, along the top, across the back and across its middle)
  band(p, CANOPY, 0.24 * PI, 0.76 * PI, 12, 2.4, 5.35, 12, 0.02);
  for (const [t0, t1] of [[0.232 * PI, 0.25 * PI], [0.75 * PI, 0.768 * PI], [0.494 * PI, 0.506 * PI]]) band(p, 'black', t0, t1, 1, 2.36, 5.38, 12, 0.03);
  for (const z of [2.36, 3.9]) band(p, 'black', 0.232 * PI, 0.768 * PI, 12, z, z + 0.08, 1, 0.03);
  // lit cabin windows along the charcoal bands, both sides
  for (const t of [0.17 * PI, 0.83 * PI]) for (const z of [-2.6, -1.7, 1.9, 2.8]) { onHull(p, 'dark', [0.52, 0.26, 0.02], t, z, 0.004); onHull(p, [1.5, 1.35, 1.1], [0.44, 0.18, 0.02], t, z, 0.012, 'glow'); }
  // panel lines: thin dark seams round the hull, every so often
  for (const z of [-3.8, -0.3, 3.0]) for (let k = 0; k < 48; k++) onHull(p, 'dark', [0.02, 0.135, 0.008], -0.5 * PI + 2 * PI * (k + 0.5) / 48, z, -0.002);
  // the name on the top rear, both sides
  decalOn(p, 'label:KESTREL', 1.5, 0.37, 0.36 * PI, -3.1, -1);
  decalOn(p, 'label:KESTREL', 1.5, 0.37, 0.64 * PI, -3.1, 1);

  // the wings: a flat planform, thin, under the middle; charcoal leading edges, a light at each tip
  for (const s of [-1, 1]) {
    const pts = [[1.2, 1.4], [4.5, -1.7], [4.75, -2.0], [4.75, -2.9], [1.2, -3.7]].map(([x, z]) => [s * x, -z]);
    const outline = s > 0 ? pts : pts.reverse();
    p.extrude('white2', outline, 0.26, 0.05).rotateX(-PI / 2).translate(0, 1.42, 0);
    const le = [[1.2, 1.4], [4.5, -1.7]], len = Math.hypot(le[1][0] - le[0][0], le[1][1] - le[0][1]), ang = Math.atan2(le[1][1] - le[0][1], le[1][0] - le[0][0]);
    p.box('black', [len, 0.16, 0.12], [s * (le[0][0] + le[1][0]) / 2, 1.55, (le[0][1] + le[1][1]) / 2], [0, -s * ang, 0], { r: 0.05, cell: 0.8 });
    p.slab('black', s > 0 ? 4.62 : -4.82, s > 0 ? 4.82 : -4.62, 1.4, 1.72, -2.95, -1.75, { r: 0.04 });
    p.glowSlab(s < 0 ? 'red' : 'green', s > 0 ? 4.82 : -4.84, s > 0 ? 4.84 : -4.82, 1.55, 1.63, -2.1, -1.9);
    p.slab('orange', s > 0 ? 3.2 : -4.4, s > 0 ? 4.4 : -3.2, 1.678, 1.684, -2.8, -2.2, { r: 0 });
    // an engine on top of each wing: a nacelle, its pylon, a dark intake and a dim blue glow at the back
    const ex = s * 2.55, ey = 2.2;
    const g = new THREE.LatheGeometry([[0.001, 0], [0.38, 0], [0.47, 0.25], [0.52, 0.8], [0.5, 2.4], [0.44, 2.85], [0.4, 3.0], [0.001, 3.0]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    g.rotateX(-PI / 2); g.translate(ex, ey, -1.3); p.add('solid', g, 'white2');
    p.cyl('dark', 0.36, 0.05, [ex, ey, -1.31], [PI / 2, 0, 0], 24); p.cyl('gun', 0.12, 0.12, [ex, ey, -1.32], [PI / 2, 0, 0], 16);
    // the nozzle: a gunmetal bell flaring out behind, dark inside
    const bell = new THREE.LatheGeometry([[0.3, 0.0], [0.37, 0.0], [0.4, 0.06], [0.46, 0.44], [0.43, 0.46], [0.34, 0.1], [0.28, 0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    bell.rotateX(-PI / 2); bell.translate(ex, ey, -4.26); p.add('solid', bell, 'gun');
    p.cyl('black', 0.42, 0.1, [ex, ey, -4.26], [PI / 2, 0, 0], 28); p.cyl('dark', 0.3, 0.04, [ex, ey, -4.33], [PI / 2, 0, 0], 20);
    p.cyl('gun', 0.1, 0.06, [ex, ey, -4.34], [PI / 2, 0, 0], 14);   // (the injector in the middle: parked, so no glow)
    for (const z of [-1.9, -3.4]) p.cyl('black', 0.53, 0.06, [ex, ey, z], [PI / 2, 0, 0], 28);
    // the pylon: a fairing from the wing up into the nacelle
    p.slab('white2', ex - 0.17, ex + 0.17, 1.6, ey - 0.25, -3.5, -1.55, { r: 0.08, seg: 2 }); p.slab('black', ex - 0.18, ex + 0.18, 1.62, 1.72, -3.55, -1.5, { r: 0.04 });
  }
  // the fin, with a white light at its top
  { const pts = [[-2.6, 0], [-4.5, 1.75], [-5.55, 1.75], [-5.3, 0]];
    p.extrude(HULL, pts, 0.16, 0.03).rotateY(-PI / 2).translate(0.08, 2.95, 0);   // (its foot sunk into the hull all along)
    p.slab('black', -0.1, 0.1, 4.66, 4.76, -5.55, -4.45, { r: 0.04 }); p.glowSlab('white', -0.04, 0.04, 4.76, 4.78, -5.2, -5.05);
    p.slab('orange', -0.085, 0.085, 4.2, 4.35, -5.35, -4.25, { r: 0.006 }); }
  // the door, set into the hull on its left side: a pale leaf following the hull's curve, a yellow frame round it, a
  // small window, a handle, a step plate along the sill and a green light over it
  { const z0 = DOOR.z - DOOR.w / 2, z1 = DOOR.z + DOOR.w / 2, y0 = DOOR.sill, y1 = DOOR.sill + DOOR.h, NZd = 6, NY = 12, m = new MeshData();
    for (let j = 0; j <= NZd; j++) for (let i = 0; i <= NY; i++) { const z = z0 + (z1 - z0) * j / NZd, t = tLeft(y0 + (y1 - y0) * i / NY, z), P = hullAt(t, z, 0.012), N = hullNormal(t, z); m.v(P.x, P.y, P.z, N.x, N.y, N.z); }
    for (let j = 0; j < NZd; j++) for (let i = 0; i < NY; i++) { const a = j * (NY + 1) + i; m.quad(a, a + 1, a + NY + 2, a + NY + 1); }
    p.add('solid', fixWinding(m.geometry()), 'white2');
    for (let i = 0; i < NY; i++) { const y = y0 + (y1 - y0) * (i + 0.5) / NY; for (const z of [z0 - 0.04, z1 + 0.04]) onHull(p, 'yellow', [0.07, (y1 - y0) / NY + 0.02, 0.03], tLeft(y, z), z, 0.004); }
    for (const [y, w] of [[y0 - 0.03, 0.08], [y1 + 0.04, 0.08]]) onHull(p, 'yellow', [DOOR.w + 0.15, w, 0.03], tLeft(y, DOOR.z), DOOR.z, 0.004);
    onHull(p, 'dark', [0.36, 0.26, 0.016], tLeft(y0 + 1.38, DOOR.z), DOOR.z, 0.02);
    onHull(p, 'band', [DOOR.w - 0.1, 0.16, 0.012], tLeft(y0 + 0.86, DOOR.z), DOOR.z, 0.02);
    onHull(p, 'black', [0.06, 0.2, 0.04], tLeft(y0 + 1.0, z1 - 0.12), z1 - 0.12, 0.02);
    onHull(p, 'black', [0.62, 0.08, 0.04], tLeft(y1 + 0.16, DOOR.z), DOOR.z, 0.006); onHull(p, 'green', [0.54, 0.04, 0.01], tLeft(y1 + 0.16, DOOR.z), DOOR.z, 0.045, 'glow');
    const Ps = hullAt(tLeft(y0 + 0.01, DOOR.z), DOOR.z); p.slab('gun', Ps.x - 0.14, Ps.x + 0.06, y0 - 0.05, y0, z0 - 0.05, z1 + 0.05, { r: 0.012 });
    p.light([Ps.x - 0.5, y1, DOOR.z], 0.6, [0.5, 1, 0.6], [-1, -0.5, 0], 3); }
  // the legs: a nose leg and two under the wings, each a strut with a shiny piston and a broad foot
  for (const [x, z, top] of [[0, 3.9, 1.05], [-1.7, -1.9, 1.5], [1.7, -1.9, 1.5]]) {
    p.cyl('black', 0.14, top - 0.55, [x, (top + 0.55) / 2, z], null, 16); p.cyl('chrome', 0.085, 0.5, [x, 0.33, z], null, 14); p.cyl('black', 0.16, 0.08, [x, 0.6, z], null, 16);
    p.lathe('black', [[0.001, 0], [0.38, 0], [0.39, 0.05], [0.3, 0.11], [0.11, 0.14], [0.001, 0.14]], 22, [x, 0, z]);
    p.box('black', [0.07, Math.hypot(top - 0.75, 0.55), 0.07], [x, (top + 0.75) / 2, z + 0.275], [-Math.atan2(0.55, top - 0.75), 0, 0], { r: 0.02 });
    p.box('dark', [0.06, top - 0.3, 0.5], [x + (x < 0 ? -0.2 : x > 0 ? 0.2 : 0.25), (top + 0.3) / 2, z], null, { r: 0.02 });
  }
}
// the angle round the hull, on its left side, where it stands at height y (at z)
function tLeft(y, z) { const [, b, yc] = section(z), rel = Math.max(-0.999, Math.min(0.999, (y - yc) / b)); return PI - Math.asin(Math.sign(rel) * Math.pow(Math.abs(rel), NPOW / 2)); }
// where the door's sill meets the hull (the boarding stair's platform comes up to here)
export function doorSill() { return hullAt(tLeft(DOOR.sill + 0.01, DOOR.z), DOOR.z); }
// a decal laid on the hull (rect from the decal sheet), w x h, at angle t and z; dir 1 reads nose-first on the right
function decalOn(p, rect, w, h, t, z, dir) {
  const P = hullAt(t, z, 0.006), N = hullNormal(t, z), X = new THREE.Vector3(0, 0, dir), Y = new THREE.Vector3().crossVectors(N, X).normalize().negate();
  const q = new (p.constructor)(); q.decal(rect, w, h, [0, 0, 0], null, '#2a2c30');
  const g = q.parts[0].geo; g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y.negate(), N).setPosition(P)); p.parts.push(q.parts[0]);
}
