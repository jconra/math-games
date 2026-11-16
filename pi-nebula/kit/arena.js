// THE ARENA: Mathball's court, as the station builds it (the game's maker's Tron-style number-ball game, in the square
// inside the loop: "something that reminds me of Tron (as far as lights and style)"). His picks (2026-11-16):
//   the court   AR3-1 D: an octagon stretched to the room's 18 m, a goal across each corner (src/mathball/court.js has
//               every number this draws from, so the game and this never disagree)
//   the goals   AR2-2 D, "proud of the wall": chunky cheeks and a brow standing 40 cm out, light strips inside the mouth,
//               the sign's board on the brow, leaning out to face the court. The board is drawn blank: the rule on it
//               changes during play, so the game lays its sign on it (src/mathball/view.js)
//   the ports   AR2-7 B: the balls are shot out of round ports in the long walls
//   the floor   a dark floor, drawn here; its hexagons of light, the glow from each goal and the "strike" are the game's
//               own, live (view.js), on top of it
//   the bar     a rail round the room over the goals, at COURT.bar.y: the light bar that runs along it is the game's
//
//   arena   a CELL piece, 'octagon': the whole room inside: floor, the eight walls two storeys high (dark panels with
//           lines of light along their foot, along the bar's rail and along their top, a line of light up each corner),
//           the four goals, the six ports, the ceiling and its light strips, the door's frame of light. Placed on the
//           arena room's middle cell (station.json: cell [4, 6]). Its frame is the court's own (court.js).
import * as THREE from 'three';
import { bevelBox, put, circle, sweep, bend, MeshData, cylinder } from './geo.js';
import { COURT, CORNERS, WALLS, GOALS, PORTS } from '../src/mathball/court.js';

const PI = Math.PI;
// the arena's surfaces: dark, never pure black (their bevels must catch the glow)
const FLOOR = { c: '#15181e', r: 0.24, m: 0.45, w: 0.15 };
const WALL = { c: '#252a33', r: 0.42, m: 0.3, w: 0.2 };
const DEEP = { c: '#101318', r: 0.5, m: 0.2, w: 0.1 };
const TRIM = { c: '#4a525e', r: 0.3, m: 0.55, w: 0.3 };
const GLOSS = { c: '#0f1116', r: 0.12, m: 0.6, w: 0.1 };
const HOUSE = { c: '#7f8a9b', r: 0.35, m: 0.3, w: 0.2 };
const PORT = { c: '#07080b', r: 0.6, m: 0.1, w: 0.05 };
// lines of light (linear): the room's cyan, the ceiling's white
export const ARENA_GLOW = { line: [0.06, 0.62, 1.25], corner: [0.09, 0.8, 1.6], ceiling: [2.4, 2.5, 2.6], port: [0.05, 0.55, 1.1] };
const mul = (c, k) => c.map((v) => v * k);
const lightOf = (c) => { const m = Math.max(...c); return c.map((v) => v / m); };

// a glowing box from two corners
const glow = (p, look, x0, x1, y0, y1, z0, z1) => p.add('glow', bevelBox([x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], { r: 0.002, seg: 1, cell: 9 }), look);
// a flat glowing strip between two points, w wide, lying in the plane facing n
function strip3(p, look, a, b, w, n) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), N = new THREE.Vector3(...n).normalize(), s = new THREE.Vector3().subVectors(B, A).cross(N).normalize().multiplyScalar(w / 2), m = new MeshData();
  const v = (P, k) => m.v(P.x + s.x * k, P.y + s.y * k, P.z + s.z * k, N.x, N.y, N.z);
  m.quad(v(A, -1), v(B, -1), v(B, 1), v(A, 1)); return p.add('glow', m.geometry(), look);
}
// a sub-piece built in its own frame, then put at `at` turned by ry about the up axis
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function sub(p, build, at, ry) {
  const q = new (p.constructor)(); build(q);
  _q.setFromAxisAngle(_up, ry);
  for (const part of q.parts) { put(part.geo, at, [0, ry, 0]); p.parts.push(part); }
  for (const L of q.lights) p.lights.push({ ...L, at: _v.set(...L.at).applyQuaternion(_q).add(new THREE.Vector3(...at)).toArray(), dir: L.dir ? new THREE.Vector3(...L.dir).applyQuaternion(_q).toArray() : null });
  return q;
}
// a wall's frame: x along it (from its corner A at -len/2), z out of its face into the court, y up
const frameOf = (W) => ({ at: [W.mid[0], 0, W.mid[1]], ry: Math.atan2(W.n[0], W.n[1]) });
// rectangles [x0, x1, y0, y1] less the holes in them
function minus(r, holes) {
  let rects = [r];
  for (const H of holes) {
    const next = [];
    for (const [x0, x1, y0, y1] of rects) {
      if (H.x1 <= x0 || H.x0 >= x1 || H.y1 <= y0 || H.y0 >= y1) { next.push([x0, x1, y0, y1]); continue; }
      if (H.x0 > x0) next.push([x0, H.x0, y0, y1]);
      if (H.x1 < x1) next.push([H.x1, x1, y0, y1]);
      const a = Math.max(x0, H.x0), b = Math.min(x1, H.x1);
      if (H.y0 > y0) next.push([a, b, y0, H.y0]);
      if (H.y1 < y1) next.push([a, b, H.y1, y1]);
    }
    rects = next;
  }
  return rects.filter(([x0, x1, y0, y1]) => x1 - x0 > 0.005 && y1 - y0 > 0.005);
}

// ── a wall: dark panels in two rows (split at the bar's rail), seams between them, its lines of light ─────────────────
const T = 0.2, BAR = COURT.bar.y;
function wall(q, W, holes) {
  const L = W.len, x0 = -L / 2, x1 = L / 2, n = Math.max(1, Math.round(L / 2.1)), H = COURT.height;
  q.slab(DEEP, x0, x1, 0, H, -T, -0.03, { r: 0, cell: 1.5, skip: ['-z'] });           // (the dark backing the seams show)
  for (let i = 0; i < n; i++) {
    const a = x0 + (L * i) / n, b = x0 + (L * (i + 1)) / n;
    for (const [y0, y1] of [[0, BAR - 0.05], [BAR + 0.05, H]]) for (const [c0, c1, d0, d1] of minus([a + 0.012, b - 0.012, y0 + 0.012, y1 - 0.012], holes)) q.slab(WALL, c0, c1, d0, d1, -0.06, 0, { r: 0.01, cell: 0.9, skip: ['-z'] });
  }
  // the lines of light: along the foot (broken at a hole), along the bar's rail (the rail itself is below), along the top
  for (const [a, b] of minus([x0, x1, 0.03, 0.07], holes.map((h) => ({ ...h, y0: -1 })))) glow(q, ARENA_GLOW.line, a, b, 0.03, 0.07, 0, 0.018);
  glow(q, mul(ARENA_GLOW.line, 0.7), x0, x1, H - 0.14, H - 0.1, 0, 0.018);
  // the bar's rail: a grey channel the light bar runs in (src/mathball/view.js draws the bar along it)
  q.slab(TRIM, x0, x1, BAR - 0.06, BAR + 0.06, -0.03, 0.05, { r: 0.008, cell: 0.9 });
  q.slab(DEEP, x0, x1, BAR - 0.03, BAR + 0.03, 0.05, 0.056, { r: 0, cell: 9 });
  // (a little of the line's light on the floor along the wall's foot, for the bake)
  for (let i = 0; i < n; i++) q.light([x0 + (L * (i + 0.5)) / n, 0.2, 0.25], 0.18, lightOf(ARENA_GLOW.line), [0, 0.2, 1], 1.6);
}

// ── a goal (AR2-2 D): its pocket into the room's corner, the housing standing proud, its lights, the sign's board ──────
// In the goal's frame: the mouth's middle on the floor at (0, 0, 0), the wall's face at z = 0, the court toward +z.
function goal(q, look) {
  const { w: Wm, h: H, cheek: cw, brow, out, deep: D, board: B } = COURT.goal, t = 0.06, hw = Wm / 2;
  // the pocket: floor, sides, roof, back; a dim glow of the goal's colour on its back and a net of light lines
  q.slab(FLOOR, -hw, hw, -0.12, 0, -D, -T + 0.01, { r: 0.005, cell: 0.6, loops: [] });
  for (const s of [-1, 1]) q.slab(DEEP, s > 0 ? hw : -hw - t, s > 0 ? hw + t : -hw, -0.12, H + t, -D - t, -T, { r: 0.005, cell: 0.4 });
  q.slab(DEEP, -hw, hw, H, H + t, -D - t, -T, { r: 0.005, cell: 0.4 });
  q.slab(GLOSS, -hw, hw, 0, H, -D - t, -D, { r: 0.005, cell: 0.4 });
  glow(q, mul(look, 0.05), -hw + 0.06, hw - 0.06, 0.06, H - 0.06, -D + 0.002, -D + 0.008);
  const net = mul(look, 0.32);
  for (let k = -6; k <= 6; k++) {
    const xa = k * 0.32 - H / 2, xb = k * 0.32 + H / 2;
    for (const [ax, ay, bx, by] of [[xa, 0, xb, H], [xb, 0, xa, H]]) {
      // (a diagonal from bottom to top, cut to the back's rectangle)
      const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20, x = ax + (bx - ax) * u, y = ay + (by - ay) * u; if (Math.abs(x) <= hw - 0.08 && y >= 0.08 && y <= H - 0.08) pts.push([x, y]); }
      if (pts.length >= 2) strip3(q, net, [pts[0][0], pts[0][1], -D + 0.01], [pts[pts.length - 1][0], pts[pts.length - 1][1], -D + 0.01], 0.016, [0, 0, 1]);
    }
  }
  // the housing: chunky cheeks and a brow, standing `out` from the wall, their corners rounded off
  for (const s of [-1, 1]) q.slab(HOUSE, s > 0 ? hw : -hw - cw, s > 0 ? hw + cw : -hw, 0, H, -0.02, out, { r: 0.09, seg: 1, cell: 0.5 });
  q.slab(HOUSE, -hw - cw, hw + cw, H, H + brow, -0.02, out, { r: 0.09, seg: 1, cell: 0.5 });
  // the light strips: down the mouth's inner edges, under the brow, and a line round the housing's face
  for (const s of [-1, 1]) glow(q, look, s > 0 ? hw - 0.016 : -hw, s > 0 ? hw : -hw + 0.016, 0.06, H - 0.04, 0.05, 0.32);
  glow(q, look, -hw + 0.04, hw - 0.04, H - 0.016, H, 0.05, 0.32);
  for (const s of [-1, 1]) glow(q, mul(look, 0.85), s * (hw + cw - 0.13) - 0.022, s * (hw + cw - 0.13) + 0.022, 0.12, H + brow - 0.14, out, out + 0.012);
  glow(q, mul(look, 0.85), -hw - cw + 0.13, hw + cw - 0.13, H + brow - 0.16, H + brow - 0.12, out, out + 0.012);
  // a sill of light across the mouth's floor
  strip3(q, look, [-hw + 0.02, 0.006, 0.08], [hw - 0.02, 0.006, 0.08], 0.05, [0, 1, 0]);
  // the sign's board on the brow, leaning out to face the court; a frame of light in the goal's colour round it (the
  // game lays the rule on its face)
  const c = [0, B.y, B.z], tilt = B.tilt;
  q.box(GLOSS, [B.w, B.h, 0.07], c, [tilt, 0, 0], { r: 0.025 });
  const n = [0, -Math.sin(tilt), Math.cos(tilt)], up = [0, Math.cos(tilt), Math.sin(tilt)], f = (x, y, z = 0.037) => [c[0] + x + n[0] * z, c[1] + up[1] * y + n[1] * z, c[2] + up[2] * y + n[2] * z];
  const fw = B.w / 2 - 0.03, fh = B.h / 2 - 0.03;
  strip3(q, look, f(-fw, -fh), f(fw, -fh), 0.03, n); strip3(q, look, f(-fw, fh), f(fw, fh), 0.03, n);
  strip3(q, look, f(-fw, -fh), f(-fw, fh), 0.03, n); strip3(q, look, f(fw, -fh), f(fw, fh), 0.03, n);
  // its light, for the bake: out across the court's floor in front of it, and inside the pocket
  q.light([0, H * 0.6, 1.4], 1.7, lightOf(look), [0, -0.3, 1], 4); q.light([0, H * 0.5, 0.2], 0.6, lightOf(look), null, 2);
  q.light([0, H * 0.7, -D * 0.55], 0.5, lightOf(look), null, 1.4);
}

// ── a port the balls are shot out of: a dark round mouth in a ring standing a little out of the wall ────────────────
// In the wall's frame: its middle at (0, 0, 0) on the wall's face, the court toward +z
function port(q, r) {
  q.add('solid', cylinder(r, 0.03, [0, 0, 0], 32).rotateX(PI / 2).translate(0, 0, 0.01), PORT);
  q.add('solid', sweep(circle(0.045, 10), bend([0, 0, 0.05], r + 0.05, [1, 0, 0], [0, 1, 0], 0, 2 * PI, 48), { closed: true }), TRIM);
  q.add('glow', sweep(circle(0.012, 6), bend([0, 0, 0.1], r + 0.05, [1, 0, 0], [0, 1, 0], 0, 2 * PI, 48), { closed: true }), ARENA_GLOW.port);
}

// ── the whole room inside ──────────────────────────────────────────────────────────────────────────────────────────
export function arenaRoom(p) {
  const { hx, hz, height: H } = COURT;
  // the floor (all of the room: the goals' pockets stand on it) and the ceiling
  p.slab(FLOOR, -hx - 0.2, hx + 0.2, -0.12, 0, -hz - 0.24, hz + 0.24, { r: 0.01, cell: 0.7, loops: [] });
  p.slab(DEEP, -hx - 0.2, hx + 0.2, H, H + 0.12, -hz - 0.24, hz + 0.24, { r: 0.01, cell: 1.2, loops: [] });
  // the ceiling's light strips (dim: the court is lit mostly by its own lines), and their light for the bake
  for (const x of [-2.4, 0, 2.4]) {
    const z0 = -hz + 1.2 + (Math.abs(x) > 2 ? 1.6 : 0), z1 = hz - 1.2 - (Math.abs(x) > 2 ? 1.6 : 0);
    glow(p, ARENA_GLOW.ceiling, x - 0.05, x + 0.05, H - 0.03, H, z0, z1);
    for (let z = z0 + 1.4; z < z1 - 0.5; z += 3.1) p.light([x, H - 0.4, z], 9, [0.85, 0.92, 1.0], [0, -1, 0], 10);
  }
  // the walls, with their holes: the door in the south wall, a goal's mouth in each slanted one
  const goalOn = new Map(GOALS.map((g) => [g.wall, g]));
  for (const W of WALLS) {
    const holes = [];
    if (W.i === 4) holes.push({ x0: -COURT.door.w / 2, x1: COURT.door.w / 2, y0: 0, y1: COURT.door.h });
    if (goalOn.has(W.i)) holes.push({ x0: -COURT.goal.w / 2, x1: COURT.goal.w / 2, y0: 0, y1: COURT.goal.h });
    const F = frameOf(W);
    sub(p, (q) => wall(q, W, holes), F.at, F.ry);
    if (goalOn.has(W.i)) sub(p, (q) => goal(q, goalOn.get(W.i).glow), F.at, F.ry);
    if (W.i === 4) sub(p, (q) => {
      // the door from the terminal: a frame of light round it
      const { w, h } = COURT.door;
      glow(q, ARENA_GLOW.corner, -w / 2 - 0.05, -w / 2, 0, h + 0.05, 0, 0.03); glow(q, ARENA_GLOW.corner, w / 2, w / 2 + 0.05, 0, h + 0.05, 0, 0.03);
      glow(q, ARENA_GLOW.corner, -w / 2 - 0.05, w / 2 + 0.05, h, h + 0.05, 0, 0.03);
      q.light([0, h + 0.2, 0.3], 0.4, lightOf(ARENA_GLOW.corner), [0, -0.5, 1], 2.5);
    }, F.at, F.ry);
  }
  // a line of light up each corner where two walls meet
  for (const [x, z] of CORNERS) {
    const L = Math.hypot(x, z), ix = x - (x / L) * 0.02, iz = z - (z / L) * 0.02, g = bevelBox([0.035, H - 0.2, 0.035], [0, 0, 0], { r: 0.003, seg: 1, cell: 9 });
    put(g, [ix, (H - 0.2) / 2 + 0.05, iz]); p.add('glow', g, ARENA_GLOW.corner);
  }
  // the ports, in the long walls
  for (const P of PORTS) {
    const ry = Math.atan2(P.n[0], P.n[2]);
    sub(p, (q) => port(q, P.r), P.at, ry);
  }
}

export const ARENA_PIECES = {
  arena: { name: 'Mathball court (the arena inside)', group: 'Arena', at: 'cell', variants: ['octagon'], foot: [10, 7.1, 18], build: arenaRoom },
};
