// EACH JOB'S GEAR, outside the hull, from the game's maker's pictures.
//   canister(p, { len, r, bands, stack })   the miner's big ore canisters: tan drums with rounded dark ends and a valve,
//       held in heavy orange bands with a foot each toward -x (to the hull). Frame: its axis along z, centred at
//       the origin. len 4.2, r 0.9 (sheet 2's 4.2 x 1.8 m), bands 3, stack 1 or 2 (two, one on the other, the bands
//       going round both, as his picture's two-high stacks)
//   laserArm(p, { pose, upper, fore })      a miner's laser arm: a shoulder joint at the origin, an upper arm, an
//       elbow, a forearm, a wrist and a cutting head (a toothed wheel round a glowing core), charcoal with yellow plates
//       striped black down each side. pose 'folded' (back along the hull's side: the upper arm back along -z, the
//       forearm forward along its outside, +x, the head beside the shoulder) or 'working' (reaching forward and down
//       past the nose). upper 2.6, fore 2.0 (metres). Drawn for the hull's +x side ('mirrored' in the catalog: -x)
//   scoop(p, { w })                         the ore scoop under a miner's nose: a sloping grille of ribs between two
//       dark cheeks, a heavy lip striped yellow and black, teeth under it. Frame: its back top edge at the origin
//       (against the belly), reaching +z and down. w 2.4
//   medicMark(p, { w, h, kind })            the medical mark (no red cross, which is a protected symbol): a teal pulse
//       line. kind 'plate' (a pale plate with a teal frame and the pulse across it, w 1.6 x h 0.6) or 'stripe' (a
//       long teal band with a pale pulse through it, w 3.0 x h 0.3). Facing +z, its middle at the origin, on a flat
//       hull panel
import * as THREE from 'three';
import { SHIP, GLOW_SHIP } from '../palette.js';
import { kitTextures } from '../../materials.js';
import { plane, put } from '../../geo.js';
import { Acc } from './facet.js';
import { box, bar, latheZ, putAcc } from './shapes.js';

const PI = Math.PI, v = (x, y, z) => new THREE.Vector3(x, y, z);

export function canister(p, o = {}) {
  const L = o.len ?? 4.2, r = o.r ?? 0.9, nb = o.bands ?? 3, stack = o.stack ?? 1, acc = new Acc();
  for (let k = 0; k < stack; k++) {
    const y = k * (2 * r + 0.3);
    // the drum: rounded ends (dark), a tan body, a few seams
    const e = 0.32 * r, prof = [[0, L / 2 + 0.02], [0.35 * r, L / 2], [0.75 * r, L / 2 - e * 0.5], [r, L / 2 - e], [r, -L / 2 + e], [0.75 * r, -L / 2 + e * 0.5], [0.35 * r, -L / 2], [0, -L / 2 - 0.02]];
    latheZ(acc, prof, 20, (i) => (i === 3 ? SHIP.canister : SHIP.trim), { flat: false, at: [0, y, 0] });
    for (const z of [-L / 2 + e + 0.3, L / 2 - e - 0.3]) latheZ(acc, [[r + 0.012, z + 0.03], [r + 0.012, z - 0.03]], 20, () => SHIP.trim, { flat: false, at: [0, y, 0] });
    // a valve on each end
    for (const s of [-1, 1]) latheZ(acc, s > 0 ? [[0, L / 2 + 0.16], [0.09, L / 2 + 0.16], [0.09, L / 2], [0, L / 2]] : [[0, -L / 2], [0.09, -L / 2], [0.09, -L / 2 - 0.16], [0, -L / 2 - 0.16]], 8, () => SHIP.gun, { at: [0, y, 0] });
  }
  // the clamps: a heavy band hugging each drum (faceted, orange-yellow, a dark bolt block on top), and a dark cradle
  // down the side toward -x (the hull) that holds the bands, with a foot to the hull at each
  const hw = r + 0.12, y0 = -r * 0.6, y1 = (stack - 1) * (2 * r + 0.3) + r * 0.6;   // (the cradle holds the drums at their sides)
  for (let i = 0; i < nb; i++) {
    const z = -L / 2 + bandEnd(L, r) + (L - 2 * bandEnd(L, r)) * (nb > 1 ? i / (nb - 1) : 0.5), bw = 0.3;
    for (let k = 0; k < stack; k++) {
      const y = k * (2 * r + 0.3);
      latheZ(acc, [[r + 0.005, z + bw / 2], [r + 0.11, z + bw / 2], [r + 0.11, z - bw / 2], [r + 0.005, z - bw / 2]], 12, () => SHIP.canBand, { at: [0, y, 0], phase: Math.PI / 12 });
      box(acc, SHIP.trim, [-0.13, 0.13], [y + r + 0.08, y + r + 0.17], [z - 0.1, z + 0.1]);
    }
    box(acc, SHIP.trim, [-hw - 0.08, -hw + 0.06], [y0, y1], [z - bw / 2 - 0.05, z + bw / 2 + 0.05]);
    box(acc, SHIP.trim, [-hw - 0.32, -hw - 0.08], [(y0 + y1) / 2 - 0.22, (y0 + y1) / 2 + 0.22], [z - bw / 2 - 0.05, z + bw / 2 + 0.05]);
  }
  // (a dark rail along the cradle, joining the clamps)
  box(acc, SHIP.trim, [-hw - 0.06, -hw + 0.04], [(y0 + y1) / 2 - 0.12, (y0 + y1) / 2 + 0.12], [-L / 2 + bandEnd(L, r), L / 2 - bandEnd(L, r)]);
  return acc.flush(p);
}
const bandEnd = (L, r) => 0.32 * r + 0.25;   // (where the outer bands sit, in from the ends)

// a joint: a fat drum across (along x), dark with a gunmetal hub
function joint(acc, at, r, w) {
  latheZ(acc, [[0, w / 2], [r, w / 2], [r, -w / 2], [0, -w / 2]], 10, () => SHIP.trim, { axis: 'x', at });
  latheZ(acc, [[0, w / 2 + 0.04], [r * 0.5, w / 2 + 0.04], [r * 0.5, -w / 2 - 0.04], [0, -w / 2 - 0.04]], 8, () => SHIP.gun, { axis: 'x', at });
}
// an arm segment from a to b: a dark box with a yellow plate down each side, black hazard stripes across it, as his
// picture's arms
function segment(p, acc, a, b, w, d) {
  bar(acc, SHIP.trim, a, b, w, d);
  const A = v(...a), B = v(...b), L = A.distanceTo(B), mid = A.clone().add(B).multiplyScalar(0.5), dir = B.clone().sub(A).normalize();
  const xAx = Math.abs(dir.y) > 0.99 ? v(1, 0, 0) : v(0, 1, 0).cross(dir).normalize(), zAx = xAx.clone().cross(dir);
  for (const s of [1, -1]) {
    const side = xAx.clone().multiplyScalar(s);
    bar(acc, SHIP.yellow, A.clone().addScaledVector(dir, 0.2).addScaledVector(side, w / 2).toArray(), B.clone().addScaledVector(dir, -0.2).addScaledVector(side, w / 2).toArray(), 0.012, d * 0.8);
    const g = plane(L - 0.5, d * 0.62, { uv: kitTextures().decal.rect.hazard, cell: 9 });
    // (the decal faces out of that side: its x along the arm, its normal the side)
    const M = new THREE.Matrix4().makeBasis(dir.clone().multiplyScalar(s), zAx, side).setPosition(mid.clone().addScaledVector(side, w / 2 + 0.01));
    g.applyMatrix4(M); p.add('decal', g, '#26282c');
  }
}
export function laserArm(p, o = {}) {
  const pose = o.pose || 'folded', U = o.upper ?? 2.6, F = o.fore ?? 2.0, acc = new Acc();
  // the shoulder: a mount block against the hull (-x) and the joint
  box(acc, SHIP.trim, [-0.55, -0.15], [-0.4, 0.4], [-0.45, 0.45]);
  joint(acc, [0, 0, 0], 0.5, 0.72);
  // three jointed sections, as his: the upper arm, the forearm, a short wrist that carries the cutter
  let elbow, wrist, head;
  if (pose === 'working') { elbow = [0.4, 0.25, U * 0.8]; wrist = [0.5, -1.0, U * 0.8 + F * 0.55]; head = [0.5, -1.15, U * 0.8 + F * 0.55 + 0.5]; }   // (bent hard at the elbow, the cutter reaching forward and down, as his)
  else { elbow = [0.3, -0.12, -U]; wrist = [1.0, -0.3, -U + F]; head = [1.03, -0.32, -U + F + 0.55]; }   // (the forearm outside the upper arm, clear of it)
  segment(p, acc, [0, 0, 0], elbow, 0.66, 0.72);
  joint(acc, elbow, 0.44, 0.72);
  segment(p, acc, elbow, wrist, 0.56, 0.62);
  joint(acc, wrist, 0.36, 0.6);
  bar(acc, SHIP.trim, wrist, head, 0.36, 0.4);
  // the cutting head: a toothed wheel (facing along the wrist) round a glowing orange core
  const sub = new Acc(), R = 0.42;
  latheZ(sub, [[0, 0.1], [R * 0.45, 0.1], [R * 0.45, 0.06], [R, 0.06], [R, -0.1], [0, -0.1]], 12, (i) => (i === 0 ? { glow: GLOW_SHIP.cutter } : SHIP.trim));
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2, q = new Acc(); box(q, SHIP.gun, [-0.055, 0.055], [R - 0.02, R + 0.1], [-0.09, 0.05]); putAcc(sub, q, new THREE.Matrix4().makeRotationZ(a)); }
  latheZ(sub, [[R * 0.3, 0.12], [R * 0.3, 0.1], [R * 0.45, 0.1]], 12, () => SHIP.yellow);
  const dir = v(...head).sub(v(...wrist)).normalize(), Q = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), dir);
  putAcc(acc, sub, new THREE.Matrix4().compose(v(...head).addScaledVector(dir, 0.1), Q, v(1, 1, 1)));
  acc.flush(p);
  p.light(v(...head).addScaledVector(dir, 0.5).toArray(), 0.5, [1.6, 0.7, 0.2], dir.toArray(), 2.5);
  return p;
}
export function scoop(p, o = {}) {
  const w = o.w ?? 2.4, acc = new Acc(), n = Math.max(6, Math.round(w / 0.24));
  // a sloping grille (his miner's), from a beam under the belly down and forward to a heavy lip: a dark cheek each
  // side, ribs down the slope with gaps between them, the lip striped yellow and black along its front, short teeth
  // under it
  box(acc, SHIP.trim, [-w / 2, w / 2], [-0.14, 0], [-0.12, 0.12]);
  for (const s of [-1, 1]) { const x = s * (w / 2 - 0.06); bar(acc, SHIP.trim, [x, -0.05, 0], [x, -0.6, 1.1], 0.12, 0.3); }
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.2 + (w - 0.4) * i / (n - 1); bar(acc, SHIP.gun, [x, -0.08, 0.05], [x, -0.58, 1.02], 0.07, 0.12); }
  box(acc, SHIP.trim, [-w / 2, w / 2], [-0.72, -0.5], [1.0, 1.16]);
  for (let i = 0; i < n - 1; i++) { const x = -w / 2 + 0.3 + (w - 0.6) * i / (n - 2); box(acc, SHIP.gun, [x - 0.04, x + 0.04], [-0.8, -0.72], [1.06, 1.14]); }
  acc.flush(p);
  const g = plane(w - 0.1, 0.18, { uv: kitTextures().decal.rect.hazard, cell: 9 }); put(g, [0, -0.61, 1.163]); p.add('decal', g, '#d9a21e');
  return p;
}
// the pulse line (an ECG trace): points [x, y] across -0.5..0.5 by -0.5..0.5
const PULSE = [[-0.5, 0], [-0.18, 0], [-0.12, 0.12], [-0.07, 0], [-0.03, 0], [0.01, -0.28], [0.06, 0.5], [0.11, -0.4], [0.15, 0], [0.24, 0], [0.3, 0.16], [0.37, 0], [0.5, 0]];
function ribbon(acc, pts, width, z, surf) {
  // a flat polyline of width `width` facing +z, mitred at its corners
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l * width / 2, ny = (bx - ax) / l * width / 2;
    acc.poly([v(ax - nx, ay - ny, z), v(bx - nx, by - ny, z), v(bx + nx, by + ny, z), v(ax + nx, ay + ny, z)], v(0, 0, 1), surf, 'solid', 9);
    // (a round-ish joint: a small square at each corner)
    acc.poly([v(bx - width / 2, by - width / 2, z), v(bx + width / 2, by - width / 2, z), v(bx + width / 2, by + width / 2, z), v(bx - width / 2, by + width / 2, z)], v(0, 0, 1), surf, 'solid', 9);
  }
}
export function medicMark(p, o = {}) {
  const kind = o.kind || 'plate', acc = new Acc();
  if (kind === 'stripe') {
    const w = o.w ?? 3.0, h = o.h ?? 0.3;
    box(acc, SHIP.teal, [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.006]);
    ribbon(acc, PULSE.map(([x, y]) => [x * w * 0.4, y * h * 0.9]), 0.035, 0.008, SHIP.hull);
  } else {
    const w = o.w ?? 1.6, h = o.h ?? 0.6, f = 0.05;
    box(acc, SHIP.hull, [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.006]);
    for (const [x0, x1, y0, y1] of [[-w / 2, w / 2, h / 2 - f, h / 2], [-w / 2, w / 2, -h / 2, -h / 2 + f], [-w / 2, -w / 2 + f, -h / 2, h / 2], [w / 2 - f, w / 2, -h / 2, h / 2]]) box(acc, SHIP.teal, [x0, x1], [y0, y1], [0.006, 0.008]);
    ribbon(acc, PULSE.map(([x, y]) => [x * (w - 0.2), y * (h - 0.16)]), 0.05, 0.008, SHIP.teal);
  }
  return acc.flush(p);
}
