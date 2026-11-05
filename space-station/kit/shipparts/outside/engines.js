// ENGINES: the big main engine, an engine pod for wings and sides, and the swivelling manoeuvring thrusters, from the
// game's maker's pictures (dark faceted drums, a band of blue light round the back, a glowing blue nozzle).
//
//   mainEngine(p, { r, len, sides, band, lit })
//       Frame: the middle of its front face at the origin (that face goes against the hull's tail), the drum running
//       back along -z to its nozzle at z = -len. r 1.1 (the drum's radius), len 1.9, sides 8 (an octagon, flat on
//       the bottom, as his medic and explorer ships) or 24 (round, as his miner's), band the paint round the drum's
//       front ('hull' off-white, 'yellow', or null: all dark), lit true (glowing) or false (parked: a dim glow).
//   enginePod(p, { r, len, sides, band, lit, pylon })
//       A smaller nacelle with an intake at the front. Frame: its axis along z, the intake's lip at z = 0, its nozzle
//       at z = -len. r 0.55, len 2.6, pylon { side: -1, len: 0.6 } a flat strut from its side toward -x (or +x) to the
//       hull or a wing (null: none).
//   thrusterPod(p, { plume, size })
//       A manoeuvring thruster's pod alone (his miner's corner pods): a chunky block, dark with off-white panels, a
//       square blue-lit nozzle on its +z face, a swivel boss under it; plume (a short glowing jet out of the nozzle).
//       Its origin, the middle of the block, is the pivot it turns on. size 1 (a 0.5 x 0.42 x 0.6 m block).
//   thruster(p, { mount, arm, yaw, pitch, plume, size })
//       A pod on its mount. Frame: the mount's foot at the origin, on the hull. mount 'top' (a pylon standing up off
//       the roof), 'side' (an arm out along +z from a side wall, the pod sitting on its end: turn the part to face out
//       of the hull), 'under' (hanging from the belly, the pod upside down); arm its length (0.45 m). The pod turns on
//       a cradle at the arm's end: yaw (degrees round the up axis; 0 points its jet along +z, 90 toward +x), pitch
//       (degrees; up is positive).
//   thrusterPivot(o)          where that pod's pivot is, in the thruster's frame
//   swivelRot(yaw, pitch, under)   the rot [rx, ry, rz] (place.js's order) that turns a thrusterPod piece by that
//       swivel: a ship (or later the game) can draw the mount with thruster's arm and no pod, or place the pod alone
//       at thrusterPivot and turn it
import * as THREE from 'three';
import { SHIP, GLOW_SHIP } from '../palette.js';
import { Acc } from './facet.js';
import { latheZ, box } from './shapes.js';

const PI = Math.PI;
const BAND = { hull: SHIP.hull, yellow: SHIP.yellow, white2: SHIP.hull2, grey: SHIP.grey };

export function mainEngine(p, o = {}) {
  const R = o.r ?? 1.1, L = o.len ?? 1.9, n = o.sides ?? 8, lit = o.lit ?? true, band = BAND[o.band ?? 'hull'] || SHIP.trim;
  const glow = { glow: lit ? GLOW_SHIP.engine : GLOW_SHIP.engineDim }, core = { glow: lit ? GLOW_SHIP.engine.map((c) => c * 1.25) : GLOW_SHIP.engineDim };
  const acc = new Acc(), T = SHIP.trim, G = SHIP.gun;
  // the profile, front to back: a collar against the hull, a chamfer, the drum (a pale band, then dark), a seam,
  // the glowing band in a groove, a heavy rear rim, the back face stepping into a recess, the nozzle ring, the core
  // (each point with the paint of the band that starts at it)
  const z = (d) => -d, b1 = 0.3 + (L - 1.0) * 0.45, g0 = L - 0.82, g1 = L - 0.4;
  const pts = [
    [[0, 0], T], [[0.8 * R, 0], T], [[0.8 * R, z(0.12)], T], [[0.92 * R, z(0.12)], T],
    [[R, z(0.3)], band], [[R, z(b1)], T], [[0.975 * R, z(b1 + 0.03)], T], [[0.975 * R, z(b1 + 0.05)], T], [[R, z(b1 + 0.08)], T],
    [[R, z(g0)], T], [[0.95 * R, z(g0 + 0.04)], glow], [[0.95 * R, z(g1)], T], [[1.05 * R, z(g1 + 0.04)], T], [[1.05 * R, z(L - 0.06)], T], [[0.99 * R, z(L)], T],
    [[0.8 * R, z(L)], G], [[0.8 * R, z(L - 0.2)], G], [[0.64 * R, z(L - 0.2)], G], [[0.52 * R, z(L - 0.04)], G], [[0.42 * R, z(L - 0.04)], core], [[0.4 * R, z(L - 0.12)], core], [[0, z(L - 0.12)], null],
  ];
  latheZ(acc, pts.map((q) => q[0]), n, (i) => pts[i][1] ?? T);
  // four mounting blocks round the collar, and a rib along the drum at each of them
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * PI / 2, c = Math.cos(a), s = Math.sin(a), q = new Acc();
    box(q, T, [-0.09, 0.09], [R * 0.97, R * 1.06], [z(g0), z(0.4)]);
    for (const e of q.by.values()) { const pp = e.m.p, nn = e.m.n; for (let i = 0; i < pp.length; i += 3) { const x = pp[i], y = pp[i + 1]; pp[i] = x * s + y * c; pp[i + 1] = -x * c + y * s; const nx = nn[i], ny = nn[i + 1]; nn[i] = nx * s + ny * c; nn[i + 1] = -nx * c + ny * s; } merge(acc, e); }
  }
  acc.flush(p);
  if (lit) p.light([0, 0, z(L + 0.6)], 2.4, [0.35, 0.75, 1.6], [0, 0, -1], 5);
  return p;
}
// (copy one collector's mesh into another's)
function merge(acc, e) { const m = acc.mesh(e.surf, e.mat), base = m.count; m.p.push(...e.m.p); m.n.push(...e.m.n); m.uv.push(...e.m.uv); m.ix.push(...e.m.ix.map((i) => i + base)); }

export function enginePod(p, o = {}) {
  const R = o.r ?? 0.55, L = o.len ?? 2.6, n = o.sides ?? 8, lit = o.lit ?? true, band = BAND[o.band ?? 'hull'] || SHIP.trim;
  const glow = { glow: lit ? GLOW_SHIP.engine : GLOW_SHIP.engineDim }, T = SHIP.trim, G = SHIP.gun, acc = new Acc(), z = (d) => -d;
  // the intake (a dark mouth with a fan face at its back), the lip, a pale band, the dark body, the glow band, the rim
  // and the nozzle
  const prof = [
    [0, z(0.32)], [0.62 * R, z(0.32)], [0.7 * R, z(0.02)], [0.86 * R, 0], [R, z(0.16)],
    [R, z(0.16 + L * 0.28)], [R, z(0.18 + L * 0.28)], [R, z(L - 0.62)], [0.94 * R, z(L - 0.58)], [0.94 * R, z(L - 0.3)], [1.05 * R, z(L - 0.26)], [1.05 * R, z(L - 0.05)], [0.98 * R, z(L)],
    [0.74 * R, z(L)], [0.74 * R, z(L - 0.14)], [0.5 * R, z(L - 0.02)], [0.4 * R, z(L - 0.02)], [0.38 * R, z(L - 0.1)], [0, z(L - 0.1)],
  ];
  const paint = [G, T, T, T, band, T, T, T, glow, T, T, T, T, T, G, G, { glow: glow.glow.map((c) => c * 1.2) }, { glow: glow.glow.map((c) => c * 1.2) }];
  latheZ(acc, prof, n, (i) => paint[i] ?? T);
  // the intake's fan: four dark vanes across the mouth
  for (let k = 0; k < 4; k++) { const a = k * PI / 4, q = new Acc(); box(q, SHIP.frame, [-0.6 * R, 0.6 * R], [-0.025, 0.025], [z(0.3), z(0.2)]); for (const e of q.by.values()) { rotZ(e, a); merge(acc, e); } }
  if (o.pylon) {
    // a flat strut from the pod's side toward the hull: tapered, dark, with a pale top
    const s = o.pylon.side ?? -1, len = o.pylon.len ?? 0.6, x0 = s * R * 0.8, x1 = s * (R + len);
    box(acc, SHIP.hull2, [Math.min(x0, x1), Math.max(x0, x1)], [-0.09, 0.09], [z(L * 0.75), z(L * 0.2)]);
    box(acc, T, [Math.min(x0, x1), Math.max(x0, x1)], [-0.11, -0.07], [z(L * 0.77), z(L * 0.18)]);
  }
  acc.flush(p);
  if (lit) p.light([0, 0, z(L + 0.4)], 1.2, [0.35, 0.75, 1.6], [0, 0, -1], 3.5);
  return p;
}
function rotZ(e, a) { const c = Math.cos(a), s = Math.sin(a), pp = e.m.p, nn = e.m.n; for (let i = 0; i < pp.length; i += 3) { const x = pp[i], y = pp[i + 1]; pp[i] = x * c - y * s; pp[i + 1] = x * s + y * c; const nx = nn[i], ny = nn[i + 1]; nn[i] = nx * c - ny * s; nn[i + 1] = nx * s + ny * c; } }

// ── the manoeuvring thrusters ──
export function thrusterPod(p, o = {}) {
  const k = o.size ?? 1, acc = new Acc(), T = SHIP.trim, w = 0.25 * k, h = 0.21 * k, d = 0.3 * k;
  // the block (its middle is the pivot): dark, an off-white panel on top and one down each side, a swivel boss
  // under it, its nozzle on the +z face
  box(acc, T, [-w, w], [-h, h], [-d, d - 0.05 * k]);
  box(acc, SHIP.hull, [-w * 0.86, w * 0.86], [h, h + 0.03 * k], [-d + 0.06 * k, d - 0.16 * k]);
  for (const s of [-1, 1]) box(acc, SHIP.hull2, s < 0 ? [-w - 0.02 * k, -w] : [w, w + 0.02 * k], [-h * 0.6, h * 0.7], [-d + 0.08 * k, d - 0.2 * k]);
  box(acc, SHIP.frame, [-w * 0.8, w * 0.8], [-h * 0.25, -h * 0.1], [-d - 0.015 * k, -d]);   // (a vent slot on its back)
  box(acc, SHIP.gun, [-0.075 * k, 0.075 * k], [-h - 0.07 * k, -h], [-0.075 * k, 0.075 * k]);
  // the nozzle: a heavy square bezel, a dark throat, the glowing square in it
  const zf = d - 0.05 * k;
  for (const [x0, x1, y0, y1] of [[-w, w, h * 0.62, h], [-w, w, -h, -h * 0.62], [-w, -w * 0.62, -h * 0.62, h * 0.62], [w * 0.62, w, -h * 0.62, h * 0.62]]) box(acc, SHIP.frame, [x0, x1], [y0, y1], [zf, d]);
  box(acc, SHIP.gun, [-w * 0.62, w * 0.62], [-h * 0.62, h * 0.62], [zf - 0.04 * k, zf - 0.03 * k]);
  box(acc, GLOW_SHIP.jet, [-w * 0.5, w * 0.5], [-h * 0.5, h * 0.5], [zf - 0.03 * k, zf - 0.02 * k], 'glow');
  if (o.plume) {
    // the jet: a short glowing plume out of the nozzle, flaring a little and then narrowing to a point
    const q = new Acc();
    latheZ(q, [[0, 0], [0.1 * k, 0], [0.13 * k, 0.15 * k], [0.08 * k, 0.4 * k], [0.02 * k, 0.6 * k], [0, 0.64 * k]].map(([r, z]) => [r, -z]), 10, () => ({ glow: GLOW_SHIP.jet.map((c) => c * 0.45) }), { flat: false });
    for (const e of q.by.values()) { const pp = e.m.p, nn = e.m.n; for (let i = 0; i < pp.length; i += 3) { pp[i + 2] = zf - pp[i + 2]; nn[i + 2] = -nn[i + 2]; } merge(acc, e); }
  }
  acc.flush(p);
  if (o.plume) p.light([0, 0, d + 0.4 * k], 0.6, [0.35, 0.75, 1.6], [0, 0, 1], 2.5);
  return p;
}
// the matrix that turns a pod on its pivot: yaw round the up axis, then pitch up (and, hung under a belly, upside down)
function swivel(yaw = 0, pitch = 0, under = false) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch * PI / 180, yaw * PI / 180, 0, 'YXZ'));
  if (under) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), PI));
  return q;
}
export function swivelRot(yaw = 0, pitch = 0, under = false) { return new THREE.Euler().setFromQuaternion(swivel(yaw, pitch, under), 'XYZ').toArray().slice(0, 3); }
// where a thruster's pod turns, in the thruster's frame
export function thrusterPivot(o = {}) {
  const k = o.size ?? 1, arm = o.arm ?? 0.45, mount = o.mount ?? 'top', up = 0.21 * k + 0.07 * k;
  return mount === 'side' ? [0, 0, arm] : mount === 'under' ? [0, -(arm + up), 0] : [0, arm + up, 0];
}
export function thruster(p, o = {}) {
  const k = o.size ?? 1, arm = o.arm ?? 0.45, mount = o.mount ?? 'top', acc = new Acc(), T = SHIP.trim, up = 0.21 * k + 0.07 * k, pivot = thrusterPivot(o);
  // the mount: a foot plate on the hull, a pylon, a round cradle at its end that the pod's boss turns in
  if (mount === 'side') {
    const ya = -up - 0.05;   // (the arm runs out under the pod, so the pod sits on its end)
    box(acc, T, [-0.16, 0.16], [ya - 0.16, ya + 0.16], [0, 0.05]); box(acc, SHIP.hull2, [-0.08, 0.08], [ya - 0.07, ya + 0.05], [0.05, arm]);
    box(acc, T, [-0.12, 0.12], [ya + 0.05, -up], [arm - 0.12, arm + 0.12]);
  } else {
    const s = mount === 'under' ? -1 : 1, Y = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    box(acc, T, [-0.16, 0.16], Y(0, 0.05), [-0.16, 0.16]); box(acc, SHIP.hull2, [-0.07, 0.07], Y(0.05, arm - 0.04), [-0.09, 0.09]);
    box(acc, T, [-0.12, 0.12], Y(arm - 0.04, arm), [-0.12, 0.12]);
  }
  acc.flush(p);
  // the pod, turned on its pivot
  const pod = new (p.constructor)(); thrusterPod(pod, { plume: o.plume, size: k });
  const M = new THREE.Matrix4().compose(new THREE.Vector3(...pivot), swivel(o.yaw, o.pitch, mount === 'under'), new THREE.Vector3(1, 1, 1));
  for (const part of pod.parts) { part.geo.applyMatrix4(M); p.parts.push(part); }
  for (const L of pod.lights) p.lights.push({ ...L, at: new THREE.Vector3(...L.at).applyMatrix4(M).toArray(), dir: L.dir && new THREE.Vector3(...L.dir).transformDirection(M).toArray() });
  return p;
}
