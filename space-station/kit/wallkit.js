// THE WALL KIT: things that hang on a wall panel. Each is drawn with its back on the wall's face (z = 0) and its
// bottom (or middle, for the pipes) at y = 0; a layout lifts it to its height and slides it along with `off`.
//   breaker panel, junction box, extinguisher, wall screen, stencil label, pipe run (straight, elbow, flange clamp),
//   cable tray
// Sizes (an optional last argument; left out, each is the station's): breaker and jbox { conduit: how far the conduit
// runs up the wall before it turns in (1.3, 1.2) }, pipe 'straight' and cableTray { len: how long (2) }. The ships
// (kit/shipparts/cabin) use them for their lower rooms.
import * as THREE from 'three';
import { rrect, circle, line, bend } from './geo.js';
import { SCREEN_RECT } from './tex.js';

const PI = Math.PI;

// a breaker panel: a grey box, a dark face with a row of orange switches, label tags, a status light, a conduit up
export function breaker(p, v, s) {
  p.slab('grey', -0.21, 0.21, 0, 0.56, 0, 0.11, { r: 0.016 });
  p.slab('white2', -0.215, 0.215, 0.44, 0.565, 0, 0.116, { r: 0.016 });
  p.slab('dark', -0.175, 0.175, 0.08, 0.4, 0.1, 0.118, { r: 0.006 });
  for (let i = 0; i < 4; i++) {
    const x = -0.12 + i * 0.08;
    p.slab('black', x - 0.03, x + 0.03, 0.14, 0.3, 0.118, 0.126, { r: 0.004, seg: 1 });
    p.box('orange', [0.038, 0.075, 0.03], [x, 0.24, 0.14], [-0.3, 0, 0], { r: 0.008 });   // (a neat row, all thrown up)
  }
  p.decal('breakerTags', 0.32, 0.08, [0, 0.355, 0.1185]);
  p.slab('black', 0.13, 0.19, 0.47, 0.53, 0.116, 0.124, { r: 0.004, seg: 1 }); p.glowSlab('green', 0.145, 0.175, 0.485, 0.515, 0.124, 0.128);
  conduit(p, [-0.12, 0.565, 0.055], 1, s?.conduit ?? 1.3, 0.022);   // (up the wall into the ceiling's slant, out of sight)
  p.light([0.16, 0.5, 0.2], 0.08, [0.4, 1, 0.5], [0, 0, 1], 1.5);
}

// a junction box: a white box with cut corners, a dark side panel, an orange light, a conduit down
export function jbox(p, v, s) {
  // a dark body with cut corners, a white face plate on the front, a dark hatch panel on the face
  const oct = (w, h, c) => [[-w + c, -h], [w - c, -h], [w, -h + c], [w, h - c], [w - c, h], [-w + c, h], [-w, h - c], [-w, -h + c]];
  p.extrude('dark', oct(0.19, 0.22, 0.05), 0.13, 0.014).translate(0, 0.22, 0);
  p.extrude('white', oct(0.17, 0.2, 0.04), 0.024, 0.008).translate(0, 0.22, 0.128);
  p.extrude('dark', [[-0.16, -0.18], [-0.04, -0.18], [-0.04, 0.08], [-0.16, 0.08]], 0.008, 0.003).translate(0, 0.22, 0.149);
  p.slab('black', -0.17, 0.17, 0.315, 0.322, 0.15, 0.156, { r: 0.002, seg: 1 });
  p.slab('black', -0.15, -0.09, 0.355, 0.4, 0.15, 0.162, { r: 0.006 }); p.glowSlab('orange', -0.138, -0.102, 0.365, 0.39, 0.162, 0.166);
  for (const x of [0.1, -0.1]) for (const y of [0.06, 0.38]) p.cyl('grey', 0.011, 0.008, [x + 0.04, y, 0.153], [PI / 2, 0, 0], 8);
  conduit(p, [0.1, 0.43, 0.07], 1, s?.conduit ?? 1.2, 0.02);
  p.light([-0.12, 0.38, 0.25], 0.12, [1, 0.5, 0.15], [0, 0, 1], 1.5);
}

// a fire extinguisher on its bracket: red bottle, black valve and handle, a hose down its side
export function extinguisher(p) {
  const R = 0.09, h = 0.56, cz = 0.02 + R + 0.01;
  p.slab('black', -0.06, 0.06, 0.08, 0.6, 0, 0.02, { r: 0.006 });
  const pts = [[0.001, 0], [R * 0.7, 0.002], [R * 0.95, 0.014], [R, 0.04], [R, h - 0.08], [R * 0.92, h - 0.03], [R * 0.62, h - 0.005], [0.024, h + 0.005], [0.022, h + 0.02], [0.001, h + 0.02]];
  p.lathe('red', pts, 22, [0, 0, cz]);
  for (const y of [0.15, 0.44]) p.sweep('black', rrect(0.006, 0.03, 0.002, 1), ringPath(R + 0.004, y, cz), { closed: true });
  p.cyl('black', 0.022, 0.05, [0, h + 0.045, cz], null, 12);
  p.box('black', [0.024, 0.02, 0.13], [0, h + 0.075, cz + 0.04], [0.15, 0, 0], { r: 0.006 });
  p.box('black', [0.022, 0.016, 0.11], [0, h + 0.05, cz + 0.05], [-0.1, 0, 0], { r: 0.006 });
  p.slab('chrome', -0.004, 0.004, h + 0.02, h + 0.07, cz - 0.035, cz - 0.03, { r: 0.002, seg: 1 });
  // the hose: out of the valve, down the bottle's side
  const hc = new THREE.CatmullRomCurve3([v3(0.015, h + 0.035, cz), v3(0.06, h + 0.04, cz + 0.01), v3(0.09, h - 0.02, cz + 0.03), v3(0.09, 0.3, cz + 0.04), v3(0.088, 0.17, cz + 0.035)]);
  const pathH = hc.getPoints(16).map((q) => ({ p: q, x: v3(1, 0, 0), y: v3(0, 0, 1) })); fixFrames(pathH);
  p.sweep('rubber', circle(0.011, 8), pathH, { caps: true });
  p.cyl('black', 0.016, 0.05, [0.088, 0.14, cz + 0.035], null, 10);
  p.decal('solid', 0.04, 0.09, [0, 0.24, cz + R + 0.002], null, '#e8e4da');
}
function ringPath(r, y, cz) { const out = []; for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2, c = Math.cos(a), s = Math.sin(a); out.push({ p: v3(c * r, y, cz + s * r), x: v3(c, 0, s), y: v3(0, 1, 0) }); } return out; }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// give a hand-joined path frames that never flip: the first frame's y carried along, kept square to the direction of
// travel at each point (so the profile can't twist where two pieces of path meet)
export function fixFrames(path) {
  let y = null;
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)].p, b = path[Math.min(path.length - 1, i + 1)].p, t = b.clone().sub(a).normalize();
    y = (y || path[i].y).clone(); y.addScaledVector(t, -y.dot(t));
    if (y.lengthSq() < 1e-8) { y = Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); y.addScaledVector(t, -y.dot(t)); }
    y.normalize(); path[i].y = y; path[i].x = new THREE.Vector3().crossVectors(y, t);
  }
  return path;
}
// a conduit: straight from `at` along +y (dir 1) or -y (dir -1) for `len`, then bending back into the wall (z = 0)
function conduit(p, at, dir, len, r = 0.02) {
  const [x, y0, z0] = at, y1 = y0 + dir * len, R = z0;
  const path = [...line([x, y0, z0], [x, y1, z0], [0, 0, 1], 0.2), ...bend([x, y1, 0], R, [0, 0, 1], [0, dir, 0], 0, Math.PI / 2, 6).slice(1)];
  path.push({ p: v3(x, y1 + dir * R, -0.03), x: v3(1, 0, 0), y: v3(0, 1, 0) });
  p.sweep('black', circle(r, 10), fixFrames(path));
  p.cyl('dark', r + 0.008, 0.03, [x, y0 + dir * 0.015, z0], null, 12);
  p.slab('dark', x - 0.045, x + 0.045, y1 + dir * R - 0.045, y1 + dir * R + 0.045, 0, 0.012, { r: 0.004 });      // its wall plate
  p.cyl('dark', r + 0.008, 0.02, [x, y1 + dir * R, 0.02], [PI / 2, 0, 0], 12);
}

// a wall screen: a pale bezel, a glowing blue face (where the math stations go), a button below
export function wallScreen(p, v) {
  const rect = SCREEN_RECT[v] || SCREEN_RECT.math;
  p.slab('white2', -0.28, 0.28, 0, 0.4, 0, 0.07, { r: 0.018 });
  p.slab('black', -0.245, 0.245, 0.1, 0.375, 0.062, 0.074, { r: 0.006 });
  p.screen(rect, 0.46, 0.25, [0, 0.2375, 0.0745], null, 1.15);
  p.slab('dark', -0.2, 0.2, 0.025, 0.075, 0.066, 0.072, { r: 0.004, seg: 1 });
  p.cyl('black', 0.022, 0.01, [0.17, 0.05, 0.075], [PI / 2, 0, 0], 14); p.cyl('yellow', 0.017, 0.014, [0.17, 0.05, 0.082], [PI / 2, 0, 0], 14);
  for (let i = 0; i < 5; i++) p.slab('black', -0.18 + i * 0.025, -0.17 + i * 0.025, 0.035, 0.065, 0.071, 0.074, { r: 0.002, seg: 1 });
  p.light([0, 0.24, 0.22], 0.45, [0.35, 0.65, 1], [0, 0, 1], 3);
}

// a stencilled sector name, painted on: pale paint for dark panels, or ' dark' paint for the off-white ones
export function label(p, v) { const dark = v.endsWith(' dark'); p.decal('label:' + v.replace(/ dark$/, ''), 0.44, 0.11, [0, 0, 0.002], null, dark ? '#2a2c30' : '#d9d7cf'); }

// a pipe run, off-white with dark joints: straight (2 m along x), elbow (in along x, turning down), elbow-in (turning
// into the wall), flange (a clamp ring with bolts and a hanger up to the ceiling)
const PR = 0.062;
function collar(p, at, axis) {
  const rot = axis === 'x' ? [0, 0, PI / 2] : axis === 'z' ? [PI / 2, 0, 0] : [0, 0, 0];
  p.cyl('dark', PR + 0.016, 0.05, at, rot, 20);
  p.cyl('black', PR + 0.022, 0.014, at, rot, 20);
}
export function pipe(p, v, s) {
  if (v === 'straight') { const L = (s?.len ?? 2) / 2; p.sweep('white2', circle(PR, 18), line([-L, 0, 0], [L, 0, 0], [0, 1, 0], 0.4), { caps: true }); return; }
  if (v === 'sleeve') {
    // where a pipe passes through a wall: a broad dark ring, bolted to the wall
    p.cyl('dark', PR + 0.045, 0.05, [0, 0, 0], [0, 0, PI / 2], 24); p.cyl('black', PR + 0.012, 0.07, [0, 0, 0], [0, 0, PI / 2], 20);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; p.cyl('grey', 0.008, 0.06, [0, Math.cos(a) * (PR + 0.03), Math.sin(a) * (PR + 0.03)], [0, 0, PI / 2], 8); }
    return;
  }
  if (v === 'flange') {
    collar(p, [0, 0, 0], 'x');
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3; p.cyl('grey', 0.009, 0.064, [0, Math.cos(a) * (PR + 0.012), Math.sin(a) * (PR + 0.012)], [0, 0, PI / 2], 8); }
    p.slab('black', -0.012, 0.012, PR + 0.01, PR + 0.3, -0.012, 0.012, { r: 0.004, seg: 1 });
    p.slab('black', -0.05, 0.05, PR + 0.28, PR + 0.3, -0.05, 0.05, { r: 0.004, seg: 1 });
    return;
  }
  if (v === 'valve') {
    // a valve on the run: a dark body round the pipe, a stem up, an orange hand wheel with three spokes
    collar(p, [0, 0, 0], 'x'); p.cyl('dark', PR + 0.03, 0.12, [0, 0, 0], [0, 0, PI / 2], 20);
    p.cyl('black', 0.016, 0.13, [0, PR + 0.06, 0], null, 10);
    const ring = []; for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; ring.push({ p: v3(Math.cos(a) * 0.08, PR + 0.13, Math.sin(a) * 0.08), x: v3(Math.cos(a), 0, Math.sin(a)), y: v3(0, 1, 0) }); }
    p.sweep('orange', circle(0.011, 8), ring, { closed: true });
    for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; p.box('orange', [0.08, 0.014, 0.014], [Math.cos(a) * 0.04, PR + 0.13, Math.sin(a) * 0.04], [0, -a, 0], { r: 0 }); }
    p.cyl('orange', 0.02, 0.03, [0, PR + 0.13, 0], null, 12);
    return;
  }
  // elbows: in along +x to x = 0, round a bend of radius R, then on toward e2: down ('elbow'), or back into the wall
  // ('elbow-in', drawn for a pipe 0.78 m out from its wall line, as the corridors run it: a collar where it enters).
  // A '-r' variant is the mirror image (in along -x), so a run can turn either way.
  const R = 0.2, down = v.startsWith('elbow') && !v.startsWith('elbow-in'), sx = v.endsWith('-r') ? -1 : 1;
  const e2 = down ? [0, -1, 0] : [0, 0, -1], leg = down ? 0.3 : 0.62;
  const P = [...line([-1, 0, 0], [0, 0, 0], down ? [0, 0, 1] : [0, 1, 0], 0.25)];
  const C = new THREE.Vector3(0, 0, 0).addScaledVector(new THREE.Vector3(...e2), R);
  const B = bend(C, R, [0, -e2[1], -e2[2]], [1, 0, 0], 0, PI / 2, 10).slice(1);
  const end = C.clone().add(new THREE.Vector3(R, 0, 0));
  const L = line(end, end.clone().addScaledVector(new THREE.Vector3(...e2), leg), [1, 0, 0], 0.15).slice(1);
  const path = [...P, ...B, ...L]; for (const f of path) f.p.x *= sx; fixFrames(path);
  p.sweep('white2', circle(PR, 18), path, { caps: true });
  collar(p, [-0.03 * sx, 0, 0], 'x');
  if (down) collar(p, [end.x * sx, end.y - 0.03, end.z], 'y');
  else { collar(p, [end.x * sx, 0, end.z - 0.03], 'z'); p.cyl('dark', PR + 0.05, 0.03, [end.x * sx, 0, -0.545], [PI / 2, 0, 0], 22); }
}

// a cable tray along a wall (2 m along x): a black tray on brackets, four cables in it, one of them orange
export function cableTray(p, v, s) {
  const L = (s?.len ?? 2) / 2;
  p.slab('black', -L, L, 0, 0.016, 0, 0.22, { r: 0.004, seg: 1, cell: 0.6 });
  p.slab('black', -L, L, 0, 0.07, 0.205, 0.222, { r: 0.004, seg: 1, cell: 0.6 });
  p.slab('black', -L, L, -0.02, 0.18, 0, 0.012, { r: 0.003, seg: 1, cell: 0.6 });
  for (let x = -L + 0.25; x < L; x += 1) { p.slab('dark', x - 0.02, x + 0.02, -0.06, 0.02, 0, 0.23, { r: 0.006 }); }
  const cab = [[0.04, 0.03, 'cable'], [0.095, 0.026, 'cable'], [0.145, 0.022, 'gun'], [0.185, 0.013, 'orange'], [0.07, 0.018, 'cable']];
  cab.forEach(([z, r, s], i) => {
    const y = 0.016 + r + (i === 4 ? 0.05 : 0), pts = [];
    for (let k = 0; k <= 10; k++) { const x = -L + k * 0.2 * L; pts.push(v3(x, y + Math.sin(k * 1.3 + i) * 0.004 * (i === 4 ? 2 : 1), z + Math.sin(k * 0.9 + i * 2) * 0.008)); }
    const path = pts.map((q) => ({ p: q, x: v3(0, 0, 1), y: v3(0, 1, 0) })); fixFrames(path);
    p.sweep(s, circle(r, 10), path);
  });
}
