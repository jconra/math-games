// THE MEDIC'S CREW ROOM AND ENGINEERING WALLS: the pieces its plan has that the Explorer's rooms do not (the stacked
// bunks, the lockers, the kitchen counter, the table and stools are the kit's own: bunks.js, lockers.js, mess.js).
// Frames (kit/shipparts/cabin/ship.js): WALL fittings stand on a wall line (x along it, z out, facing +z, the deck y 0).
//   singleBed(p, o)     the third crew bed, along its wall: a built-in base with two drawers on its open side and a dark
//                       plinth with a strip, a mattress, a pillow at its head (o.head: -1 the left end, +1 the right), the
//                       bedding in the look's colour, a foot-board at its foot, a reading light over its head. o.len,
//                       o.depth, o.h (the mattress's top), o.bedding, o.handle, o.trim
//   bunkStep(p, o)      the step along a bunk (the way up to the lower berth, boxing in the last of the leg's well): a
//                       low box, a shoe drawer in its face, a yellow nosing, its ends cut at 45 degrees. o.len, o.depth, o.h
//   cubby(p, o)         at the bunks' head, a cubby for each berth: two niches facing along the wall (o.face: +1 toward
//                       +x, -1 toward -x), each with a shelf, a small lamp and a little locker door; o.w (along the wall,
//                       the niches' depth), o.depth (out from it), o.h, o.berths [[y0, y1], ...]
//   wireCard(p, o)      a card on a wall with wiring painted along it: bundles of coloured wires with bends, cable ties,
//                       a tag (the game's maker, 2026-11-09: "paint the wires on with cards and use some cheap tricks").
//                       o.x, o.y0, o.w, o.h, o.n (wires), o.seed, o.tag
//   switchBox(p, o)     a box of switches: a grey case, rows of toggles each with its lit lamp, a label. o.x, o.y0, o.w,
//                       o.h, o.rows, o.cols, o.label, o.seed
//   gauge(p, o)         a round gauge: a dark rim, a pale face, ticks, a red needle. o.x, o.y, o.r, o.a (the needle's turn)
//   conduit(p, o)       a run of conduit up or across a wall, with clamps: o.a, o.b ([x, y] its ends), o.r
//   vanity(p, o)        the washroom's basin: a shallow cabinet, its free corners cut, a pale top with the basin set in
//                       it, a door with its handle, a strip under the top; the mirror-screen over it is the furnisher's
//                       (a live screen). o.w, o.depth, o.h
import * as THREE from 'three';
import { shape, solid, plate, relief, prism, add } from '../../bevel.js';
import { FACE, NAVY, SHEET } from './ship.js';
import { glowStrip, FLAT } from './bits.js';
import { segText } from './segtext.js';
import { lines, lineGeo } from './medbay.js';
import { sinkTop } from './galley.js';

const PI = Math.PI;
const box = (p, look, x0, x1, y0, y1, z0, z1) => p.slab(look, Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), Math.min(z0, z1), Math.max(z0, z1), { r: 0, cell: 9, loops: [] });
const rng = (seed) => { let s = Math.floor(seed * 1e5) % 2147483646 + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

// ── the third bed ───────────────────────────────────────────────────────────────────────────────────────────────
export function singleBed(p, o = {}) {
  const L = o.len ?? 2.0, D = o.depth ?? 1.0, top = o.h ?? 0.6, head = o.head ?? -1, bed = o.bedding || NAVY, front = D - 0.04, base = 0.08, bt = top - 0.16;
  // the base: its plan's free front corners cut; drawers in its face; a plinth set back with a strip under it
  const P = [[-L / 2, FACE], [L / 2, FACE], [L / 2, front - 0.07], [L / 2 - 0.07, front], [-L / 2 + 0.07, front], [-L / 2, front - 0.07]];
  add(p, 'white', prism(P.map(([a, b]) => [a, -b]), base, bt, { back: false }), [0, 0, 0], FLAT);
  add(p, 'dark', prism([[-L / 2, FACE], [L / 2, FACE], [L / 2, front - 0.05], [-L / 2, front - 0.05]].map(([a, b]) => [a, -b]), 0, base, { front: false, back: false }), [0, 0, 0], FLAT);
  glowStrip(p, L - 0.3, [0, base * 0.45, front - 0.05 + 0.001], [0, 0, 0], { wid: 0.01, i: 0.14, dir: [0, -0.6, 0.8], reach: 1.0 });
  for (const s of [-1, 1]) { const x = s * L / 4; add(p, 'white2', relief(shape(L / 2 - 0.16, bt - base - 0.06, 0.03, x, (base + bt) / 2), [{ inset: 0, depth: 0.006, bevel: 0.005 }]), [0, 0, front + 0.001]); add(p, o.handle || 'black', plate(shape(0.18, 0.02, 0.007, x, bt - 0.06)), [0, 0, front + 0.0075]); }
  // the mattress, the bedding over its foot two thirds, the pillow at its head
  add(p, SHEET, solid(shape(L - 0.06, front - FACE - 0.04, 0.05, 0, -(FACE + front) / 2), top - bt, { edge: 0.03, back: false }), [0, bt, 0], FLAT);
  const bx0 = head < 0 ? -L / 2 + 0.6 : -L / 2 + 0.03, bx1 = head < 0 ? L / 2 - 0.03 : L / 2 - 0.6;
  add(p, bed, solid(shape(bx1 - bx0, front - FACE - 0.02, 0.03, (bx0 + bx1) / 2, -(FACE + front) / 2), 0.03, { edge: 0.012, back: false }), [0, top - 0.012, 0], FLAT);
  add(p, SHEET, solid(shape(0.36, 0.5, 0.06, head * (L / 2 - 0.25), -(FACE + front) / 2), 0.09, { edge: 0.035, back: false }), [0, top, 0], FLAT);
  // a foot-board at its foot, its corner cut; a reading light on the wall over its head
  const fx = -head * (L / 2 - 0.02);
  add(p, o.trim || 'black', prism([[FACE, 0], [front, 0], [front, top + 0.12], [front - 0.08, top + 0.2], [FACE, top + 0.2]].map(([a, b]) => [-a, b]), fx - 0.02, fx + 0.02), [0, 0, 0], [0, PI / 2, 0]);
  const lx = head * (L / 2 - 0.3);
  add(p, 'black', solid(shape(0.16, 0.05, 0.015, lx, top + 0.62), 0.07, { edge: 0.01, back: false }), [0, 0, FACE]);
  glowStrip(p, 0.12, [lx, top + 0.6, FACE + 0.05], [PI / 2, 0, 0], { wid: 0.01, i: 0.2, dir: [0, -0.8, 0.5], reach: 1.4, pool: 0.12, poolAt: [lx, top + 0.15, 0.5] });
  return p;
}

// ── the step along the bunk ─────────────────────────────────────────────────────────────────────────────────────
export function bunkStep(p, o = {}) {
  const L = o.len ?? 2.0, D = o.depth ?? 0.25, h = o.h ?? 0.3, c = 0.06;
  add(p, 'white', prism([[-L / 2, FACE], [L / 2, FACE], [L / 2, D - c], [L / 2 - c, D], [-L / 2 + c, D], [-L / 2, D - c]].map(([a, b]) => [a, -b]), 0.06, h, {}), [0, 0, 0], FLAT);
  add(p, 'dark', prism([[-L / 2 + 0.03, FACE], [L / 2 - 0.03, FACE], [L / 2 - 0.03, D - 0.04], [-L / 2 + 0.03, D - 0.04]].map(([a, b]) => [a, -b]), 0, 0.06, { front: false, back: false }), [0, 0, 0], FLAT);
  add(p, 'white2', relief(shape(L * 0.45, h - 0.12, 0.02, -L * 0.2, (0.06 + h) / 2), [{ inset: 0, depth: 0.005, bevel: 0.004 }]), [0, 0, D + 0.001]);
  add(p, o.handle || 'black', plate(shape(0.16, 0.02, 0.007, -L * 0.2, h - 0.07)), [0, 0, D + 0.006]);
  box(p, 'yellow', -L / 2 + c, L / 2 - c, h, h + 0.004, D - 0.05, D);
  return p;
}

// ── the cubby at the bunks' head ────────────────────────────────────────────────────────────────────────────────
export function cubby(p, o = {}) {
  const w = o.w ?? 1.0, d = o.depth ?? 0.5, h = o.h ?? 1.9, s = o.face ?? 1, [fz0, fz1] = o.free || [FACE + 0.04, d - 0.04], berths = o.berths || [[0.3, 0.98], [1.08, 1.8]];
  // the body (w along the wall, d out from it), white on a dark plinth
  const xo = s * w / 2, xi = -s * w / 2;
  add(p, 'white', prism([[xi, FACE], [xo, FACE], [xo, d], [xi, d]].map(([a, b]) => [a, -b]), 0.08, h, {}), [0, 0, 0], FLAT);
  add(p, 'dark', prism([[xi, FACE], [xo - s * 0.03, FACE], [xo - s * 0.03, d - 0.03], [xi, d - 0.03]].map(([a, b]) => [a, -b]), 0, 0.08, { front: false, back: false }), [0, 0, 0], FLAT);
  // on its face toward the room, by the berths' heads: for each berth a niche (dark, a shelf in it, a lamp in its top)
  // and under it a small locker door
  const zm = (fz0 + fz1) / 2, nw = fz1 - fz0, rot = [0, s * PI / 2, 0], xf = xo + s * 0.001;
  for (const [y0, y1] of berths) {
    const a = y0 + 0.14, b = y1 - 0.06, m = (a + b) / 2;
    add(p, 'dark', plate(shape(nw, b - a, 0.025, 0, 0)), [xf, m, zm], rot);
    box(p, 'white2', xo, xo + s * 0.01, a + 0.06, a + 0.075, fz0 + 0.01, fz1 - 0.01);
    glowStrip(p, nw - 0.06, [xf + s * 0.003, b - 0.03, zm], rot, { wid: 0.008, i: 0.1, dir: [s, -0.6, 0], reach: 1.0 });
    add(p, 'white2', relief(shape(nw, a - y0 - 0.04, 0.015, 0, 0), [{ inset: 0, depth: 0.005, bevel: 0.004 }]), [xf, (y0 + a) / 2 - 0.01, zm], rot);
    add(p, o.handle || 'black', plate(shape(nw * 0.5, 0.016, 0.006, 0, 0)), [xf + s * 0.0055, (y0 + a) / 2 + 0.01, zm], rot);
  }
  return p;
}

// ── the washroom's basin ──────────────────────────────────────────────────────────────────────────────────────
export function vanity(p, o = {}) {
  const w = o.w ?? 0.46, d = o.depth ?? 0.36, h = o.h ?? 0.85, c = 0.05, P = [[-w / 2, FACE], [w / 2, FACE], [w / 2, d - c], [w / 2 - c, d], [-w / 2 + c, d], [-w / 2, d - c]].map(([a, b]) => [a, -b]);
  add(p, 'white', prism(P, 0.1, h - 0.03, { back: false }), [0, 0, 0], FLAT);
  add(p, 'dark', prism([[-w / 2 + 0.03, -FACE], [w / 2 - 0.03, -FACE], [w / 2 - 0.03, -(d - 0.04)], [-w / 2 + 0.03, -(d - 0.04)]], 0, 0.1, { front: false, back: false }), [0, 0, 0], FLAT);
  add(p, { c: '#c3c4bf', r: 0.38, m: 0.05, w: 0.5 }, prism(P, h - 0.03, h, {}), [0, 0, 0], FLAT);
  add(p, 'white2', relief(shape(w - 0.12, h - 0.24, 0.025, 0, (h + 0.07) / 2), [{ inset: 0, depth: 0.006, bevel: 0.005 }]), [0, 0, d + 0.001]);
  add(p, o.handle || 'black', plate(shape(0.14, 0.02, 0.007, 0, h - 0.13)), [0, 0, d + 0.0075]);
  glowStrip(p, w - 0.12, [0, 0.05, d - 0.04 + 0.001], [0, 0, 0], { wid: 0.008, i: 0.1, dir: [0, -0.6, 0.8], reach: 0.8 });
  const q = new p.constructor(); sinkTop(q, 0, h + 0.002, d * 0.55, Math.min(0.34, w - 0.1), Math.min(0.26, d - 0.1)); for (const pt of q.parts) p.parts.push(pt);
  return p;
}

// ── the engineering walls ───────────────────────────────────────────────────────────────────────────────────────
const WIRES = [{ c: '#b83a2a', r: 0.5 }, { c: '#c9a032', r: 0.5 }, { c: '#2f62a8', r: 0.5 }, { c: '#1c1d1f', r: 0.6 }, { c: '#d5d5cf', r: 0.5 }, { c: '#3f8a4a', r: 0.5 }, { c: '#c96a20', r: 0.5 }];
// a ribbon through points on the plane z, painted in a look
function ribbon(p, pts, t, look, z) { const g = lineGeo(pts, t, z); if (g) add(p, look, g); }
export function wireCard(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.0, w = o.w ?? 1.0, h = o.h ?? 0.3, n = o.n ?? 6, R = rng(o.seed ?? 0.3), z = FACE + 0.008;
  box(p, { c: '#2b2e33', r: 0.7, m: 0.2, w: 0.5 }, x - w / 2, x + w / 2, y0, y0 + h, FACE, z);
  // the wires: each along the card from one end to the other, dropping or rising once or twice on a 45 degree bend, kept
  // in their lane
  const lane = (h - 0.06) / n;
  for (let k = 0; k < n; k++) {
    const yb = y0 + 0.03 + lane * (k + 0.5), pts = [[x - w / 2 + 0.01, yb]];
    let py = yb;
    for (let j = 0; j < 2; j++) {
      const bx = x - w / 2 + w * (0.2 + 0.3 * j + R() * 0.2), dy = (R() - 0.5) * lane * 1.6;
      pts.push([bx, py], [bx + Math.abs(dy), py + dy]); py += dy;
    }
    pts.push([x + w / 2 - 0.01, py]);
    ribbon(p, pts, Math.min(0.016, lane * 0.7), WIRES[(k + Math.floor((o.seed ?? 0) * 10)) % WIRES.length], z + 0.001 + k * 0.0002);
  }
  // cable ties across the bundle, and a tag
  for (const t of [0.12, 0.5, 0.88]) box(p, { c: '#8f9399', r: 0.4 }, x - w / 2 + w * t - 0.008, x - w / 2 + w * t + 0.008, y0 + 0.02, y0 + h - 0.02, z, z + 0.012);
  if (o.tag) { box(p, 'white2', x + w / 2 - 0.16, x + w / 2 - 0.02, y0 + h - 0.05, y0 + h - 0.01, z + 0.012, z + 0.016); segText(p, o.tag, { h: 0.018, at: [x + w / 2 - 0.09, y0 + h - 0.03, z + 0.0165], look: 'black', gap: 0.004 }); }
  return p;
}
export function switchBox(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.2, w = o.w ?? 0.4, h = o.h ?? 0.3, rows = o.rows ?? 2, cols = o.cols ?? 6, d = 0.1, R = rng(o.seed ?? 0.7), yc = y0 + h / 2;
  add(p, 'grey', solid(shape(w, h, 0.03, x, yc), d, { edge: 0.01, back: false }), [0, 0, FACE]);
  const fz = FACE + d, lab = o.label ? 0.05 : 0;
  add(p, 'dark', plate(shape(w - 0.04, h - 0.04 - lab, 0.02, x, yc - lab / 2)), [0, 0, fz + 0.001]);
  const cw = (w - 0.08) / cols, rh = (h - 0.08 - lab) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const sx = x - w / 2 + 0.04 + cw * (c + 0.5), sy = y0 + 0.04 + rh * (r + 0.5), up = R() > 0.3;
    add(p, 'rail', plate(shape(0.013, 0.034, 0.004, sx, up ? sy + 0.012 : sy - 0.012)), [0, 0, fz + 0.004]);
    const lit = R(), col = lit < 0.6 ? [0.4, 3.2, 1.0] : lit < 0.85 ? [3.4, 2.2, 0.4] : [3.4, 0.5, 0.3];
    add(p, col, plate(shape(0.012, 0.012, 0.003, sx, sy + rh * 0.38)), [0, 0, fz + 0.0015], null, 'glow');
  }
  if (o.label) { box(p, 'white2', x - w / 2 + 0.03, x + w / 2 - 0.03, y0 + h - 0.055, y0 + h - 0.015, fz, fz + 0.004); segText(p, o.label, { h: 0.022, at: [x, y0 + h - 0.035, fz + 0.0045], look: 'black', gap: 0.005 }); }
  return p;
}
export function gauge(p, o = {}) {
  const x = o.x ?? 0, y = o.y ?? 1.5, r = o.r ?? 0.07, a = o.a ?? 0.4, z = FACE + 0.04;
  const g = new THREE.CylinderGeometry(r, r, 0.04, 10, 1, true); g.rotateX(PI / 2); g.translate(x, y, FACE + 0.02); add(p, 'black', g);
  const f = new THREE.CircleGeometry(r, 10); f.translate(x, y, z + 0.001); add(p, { c: '#e2e0d8', r: 0.5, m: 0, w: 0.2 }, f);
  for (let k = 0; k <= 6; k++) { const t = PI * 1.25 - k * PI * 1.5 / 6, c = Math.cos(t), s = Math.sin(t); lines(p, [[x + c * r * 0.6, y + s * r * 0.6], [x + c * r * 0.8, y + s * r * 0.8]], 0.005, k > 4 ? [3.4, 0.5, 0.3] : [0.15, 0.15, 0.15], z + 0.002); }
  const t = PI * 1.25 - a * PI * 1.5; lines(p, [[x, y], [x + Math.cos(t) * r * 0.7, y + Math.sin(t) * r * 0.7]], 0.006, [3.2, 0.5, 0.3], z + 0.003);
  return p;
}
export function conduit(p, o = {}) {
  const [ax, ay] = o.a || [0, 0], [bx, by] = o.b || [0, 1], r = o.r ?? 0.02, z = FACE + r + 0.005, L = Math.hypot(bx - ax, by - ay);
  const g = new THREE.CylinderGeometry(r, r, L, 6, 1); g.rotateZ(Math.atan2(bx - ax, by - ay) * -1); g.translate((ax + bx) / 2, (ay + by) / 2, z); add(p, o.look || 'grey', g);
  for (let t = 0.15; t < 1; t += 0.35) { const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t; box(p, 'black', cx - (Math.abs(bx - ax) > Math.abs(by - ay) ? 0.012 : r + 0.012), cx + (Math.abs(bx - ax) > Math.abs(by - ay) ? 0.012 : r + 0.012), cy - (Math.abs(bx - ax) > Math.abs(by - ay) ? r + 0.012 : 0.012), cy + (Math.abs(bx - ax) > Math.abs(by - ay) ? r + 0.012 : 0.012), FACE, z + r + 0.004); }
  return p;
}
