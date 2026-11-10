// OPTIONS TO CHOOSE FROM: quick sketches of props that are still to be designed, each several ways, so the game's maker
// can pick one before it is built properly. Each is a POINT piece standing on its point, its front toward +z, with a
// person-sized figure (1.8 m) beside it for scale and the floor round it. Drawn in the station's own materials; the
// glowing parts use the kit's 'core' material (its own mesh, so a moving glow can be put on it later); the haze is the
// kit's beams of light with dust (kit/beams.js), shown wherever a part is looked at in the Kit Lab.
//
//   furnaceopt   the smelter's furnace (the plan: about 4 m across, under the hall's 7 m ceiling). Each look also
//                comes '... in the hall': the same without the scale figure, to stand in the smelter's hall.
//     '1 like the picture' one round furnace like the reference picture he made (refs/station/smelter/): stepped drums, a wide open mouth at chest
//                          height glowing with the melt, a ring rail round its upper drum, a number plate and a warning
//                          sign, pipes up and down its side, curved yellow rails on the floor in front, a console
//     '2 pouring tower'    one tall tower on legs, glowing slots in its side, pouring a stream of melt from its
//                          underside into a ladle on a cart; a grating platform at the pour's height with yellow rails
//     '3 two towers'       his first picture: two numbered towers, each pouring into a tub; a catwalk behind them at
//                          the pours' height; hazard plates on the floor
//     '4 hooded crucible'  a low open crucible you look down into, the melt's glow lighting a big hood and its duct
//                          above; rails all round with a way in at the front
import { bevelBox, put, circle, bend, line, cylinder, lathe as lathe2 } from './geo.js';
import { floorQuad } from './shell.js';
import { SCREEN_RECT } from './tex.js';
import { floorDecal } from './station2.js';

const PI = Math.PI;
const HOT = [2.2, 0.6, 0.08], WHITE_HOT = [4.2, 1.7, 0.32], EMBER = [1.5, 0.36, 0.05], FIRE = [1, 0.48, 0.16];
const IRON = { c: '#6a6c70', r: 0.5, m: 0.55, w: 1.0 };     // a furnace's worn steel
const SUIT = { c: '#56708c', r: 0.65, m: 0, w: 0 };        // the scale figure: one plain blue-grey
const o9 = { r: 0.02, cell: 1.5, loops: [] };

// ── small helpers ─────────────────────────────────────────────────────────────────────────────────────────────────
// a sub-piece built in its own frame, then stood at `at` turned by ry about the up axis
function placed(p, build, at, ry = 0) {
  const q = new (p.constructor)(); build(q);
  const c = Math.cos(ry), s = Math.sin(ry), R = (v) => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  for (const part of q.parts) { put(part.geo, at, [0, ry, 0]); p.parts.push(part); }
  for (const L of q.lights) { const a = R(L.at); p.lights.push({ ...L, at: [a[0] + at[0], a[1] + at[1], a[2] + at[2]], dir: L.dir && R(L.dir) }); }
}
const glowBox = (p, look, size, at, rot) => { const g = bevelBox(size, [0, 0, 0], { r: 0.003, seg: 1, cell: 9 }); put(g, at, rot || [0, 0, 0]); return p.add('core', g, look); };
// a light that throws (almost) nothing itself but carries a beam of lit haze
const haze = (p, at, dir, beam, color = FIRE) => p.lights.push({ at, i: 0.001, color, dir, reach: 0.5, beam });
// the figure for scale: 1.8 m tall, standing on y = 0, facing +z
function person(q) {
  q.cyl(SUIT, 0.075, 0.86, [-0.1, 0.43, 0], null, 10); q.cyl(SUIT, 0.075, 0.86, [0.1, 0.43, 0], null, 10);
  q.lathe(SUIT, [[0.001, 0.82], [0.17, 0.84], [0.19, 1.0], [0.21, 1.3], [0.23, 1.42], [0.1, 1.5], [0.001, 1.51]], 12);
  q.cyl(SUIT, 0.055, 0.62, [-0.27, 1.13, 0], [0, 0, 0.1], 8); q.cyl(SUIT, 0.055, 0.62, [0.27, 1.13, 0], [0, 0, -0.1], 8);
  q.lathe(SUIT, [[0.001, 1.52], [0.06, 1.53], [0.105, 1.6], [0.11, 1.68], [0.09, 1.76], [0.05, 1.795], [0.001, 1.8]], 12);
}
// yellow safety rails: two tubes (0.55 and 1.05 m up) on posts, round an arc (angles from +x toward +z) or along a line
const RAILP = circle(0.028, 8);
function railArc(q, R, a0, a1, y0 = 0, posts = 6, cx = 0, cz = 0) {
  for (const h of [0.55, 1.05]) q.sweep('yellow', RAILP, bend([cx, y0 + h, cz], R, [1, 0, 0], [0, 0, 1], a0, a1, Math.max(8, Math.round(Math.abs(a1 - a0) * R * 2))));
  for (let i = 0; i <= posts; i++) { const a = a0 + (a1 - a0) * i / posts; q.cyl('yellow', 0.034, 1.07, [cx + R * Math.cos(a), y0 + 0.535, cz + R * Math.sin(a)], null, 8); }
}
function railLine(q, [ax, az], [bx, bz], y0 = 0, posts = 2) {
  for (const h of [0.55, 1.05]) q.sweep('yellow', RAILP, line([ax, y0 + h, az], [bx, y0 + h, bz], [0, 1, 0], 4));
  for (let i = 0; i <= posts; i++) { const t = i / posts; q.cyl('yellow', 0.034, 1.07, [ax + (bx - ax) * t, y0 + 0.535, az + (bz - az) * t], null, 8); }
}
// a stencilled digit on a plate's face (facing +z at z), h tall, centred on (x, y)
function digit(q, ch, x, y, z, h, surf = 'black') {
  const w = h * 0.58, t = h * 0.15, g = h * 0.035, s = (x0, x1, y0, y1) => q.slab(surf, x + x0, x + x1, y + y0, y + y1, z, z + 0.012, { r: 0.003, cell: 9, loops: [] });
  if (ch === '1') { s(-t / 2, t / 2, -h / 2, h / 2); s(-t * 2, -t / 2 - g, h / 2 - t, h / 2); return; }
  // '2': top, upper right, middle, lower left, bottom (stencil gaps where the strokes meet)
  s(-w / 2 + g, w / 2 - g, h / 2 - t, h / 2); s(w / 2 - t, w / 2, g, h / 2 - t - g); s(-w / 2 + g, w / 2 - g, -t / 2, t / 2);
  s(-w / 2, -w / 2 + t, -h / 2 + t + g, -g); s(-w / 2 + g, w / 2 - g, -h / 2, -h / 2 + t);
}
// a warning sign: a yellow triangle with a black bar and dot, facing +z, s on a side, its middle at (x, y)
function warning(q, x, y, z, s) {
  const g = q.extrude('yellow', [[-s / 2, -s * 0.29], [s / 2, -s * 0.29], [0, s * 0.58]], 0.02, 0.004); put(g, [x, y, z]);
  q.slab('black', x - s * 0.045, x + s * 0.045, y - s * 0.02, y + s * 0.3, z + 0.02, z + 0.026, { r: 0.002, cell: 9, loops: [] });
  q.slab('black', x - s * 0.045, x + s * 0.045, y - s * 0.17, y - s * 0.08, z + 0.02, z + 0.026, { r: 0.002, cell: 9, loops: [] });
}
// a ring of hazard paint on the floor
function hazardRing(q, R, cx = 0, cz = 0) { const n = Math.round(2 * PI * R / 0.55); for (let k = 0; k < n; k++) { const a = 2 * PI * (k + 0.5) / n; floorDecal(q, 'hazard', 0.52, 0.24, cx + R * Math.cos(a), cz + R * Math.sin(a), -a + PI / 2, '#d9b23a', 0.016); } }
const coreDisc = (p, look, r, y, x = 0, z = 0, seg = 32) => p.add('core', cylinder(r, 0.03, [x, y, z], seg), look);
// the floor round a sketch: grating, a hazard edge along its front
function deck(q, x0, x1, z0, z1) {
  floorQuad(q, 'grating', x0, x1, z0, z1, 0.012);
  for (let x = x0 + 0.5; x < x1; x += 1) floorDecal(q, 'hazard', 1, 0.24, x, z1 - 0.12, 0, '#d9b23a', 0.018);
}

// ── the console that runs the furnace ("THERMAL SYSTEMS" in his picture): a chunky desk, two screens on a raised back,
// rows of lit buttons on a sloping top, cabinet doors under it. Its operator's side is +z. ───────────────────────────
export function thermalConsole(q) {
  q.slab('gun', -0.95, 0.95, 0, 0.88, -0.45, 0.32, o9);
  for (const x of [-0.48, 0.48]) q.slab('black', x - 0.42, x + 0.42, 0.1, 0.72, 0.32, 0.335, { r: 0.004, cell: 9, loops: [] });
  for (const x of [-0.12, 0.12]) q.slab('rail', x - 0.015, x + 0.015, 0.36, 0.56, 0.335, 0.36, { r: 0.006, cell: 9, loops: [] });
  const th = 0.35; q.box('band', [1.9, 0.08, 0.62], [0, 0.93, 0.08], [th, 0, 0], o9);
  const onTop = (x, zl) => [x, 0.93 + 0.045 * Math.cos(th) - zl * Math.sin(th), 0.08 + 0.045 * Math.sin(th) + zl * Math.cos(th)];
  const cols = ['green', 'amber', 'green', 'red', 'orange', 'green', 'amber', 'blue'];
  for (const [r, zl] of [[0, -0.16], [1, 0.0], [2, 0.14]]) for (let i = 0; i < 8; i++) {
    const x = -0.78 + i * 0.13 + (i >= 4 ? 0.26 : 0); if (x > 0.85) continue;
    const g = bevelBox([0.07, 0.02, 0.055], [0, 0, 0], { r: 0.003, seg: 1, cell: 9 }); put(g, onTop(x, zl), [th, 0, 0]); q.add('glow', g, cols[(i + r * 3) % cols.length]);
  }
  q.slab('gun', -0.95, 0.95, 0.88, 1.78, -0.45, -0.2, o9);
  q.slab('black', -0.95, 0.95, 1.74, 1.8, -0.47, -0.16, o9);
  q.screen(SCREEN_RECT.radar, 0.74, 0.5, [-0.43, 1.36, -0.196]); q.screen(SCREEN_RECT.status, 0.74, 0.5, [0.43, 1.36, -0.196]);
  q.light([0, 1.3, 0.25], 0.35, [0.55, 0.8, 1], [0, 0, 1], 2.5);
}

// ── 1: one furnace like his picture ───────────────────────────────────────────────────────────────────────────────
function furnaceHis(p, hall) {
  // the drums: a wide lower one with a flared foot, a step (a ring walkway with its rail), a narrower upper one, a cap
  p.lathe(IRON, [[0.001, 0], [2.2, 0], [2.2, 0.22], [2.0, 0.3], [2.0, 3.0], [2.14, 3.04], [2.14, 3.24], [1.72, 3.28], [1.72, 5.0], [1.8, 5.04], [1.8, 5.24], [1.25, 5.62], [1.25, 6.0], [0.001, 6.02]], 40);
  for (const [r, y] of [[2.02, 0.62], [2.02, 2.62], [1.74, 4.2]]) p.lathe('black', [[r - 0.02, y], [r + 0.03, y], [r + 0.03, y + 0.1], [r - 0.02, y + 0.1]], 40);
  railArc(p, 2.06, 0, 2 * PI, 3.24, 12);
  // THE MOUTH: a framed housing out of the lower drum's front, open, the melt glowing inside it
  const z0 = 1.55, zf = 2.9, mw = 0.74, y0 = 1.12, y1 = 2.36;
  p.slab(IRON, -1.08, -mw, 0.82, 2.76, z0, zf, o9); p.slab(IRON, mw, 1.08, 0.82, 2.76, z0, zf, o9);
  p.slab(IRON, -1.08, 1.08, y1, 2.76, z0, zf, o9); p.slab(IRON, -1.08, 1.08, 0.82, y0, z0, zf + 0.12, o9);
  for (const [a, b, c, d] of [[-1.12, -mw + 0.02, 0.78, 2.8], [mw - 0.02, 1.12, 0.78, 2.8], [-1.12, 1.12, y1 - 0.02, 2.8]]) p.slab('black', a, b, c, d, zf, zf + 0.05, { r: 0.01, cell: 9, loops: [] });
  glowBox(p, HOT, [mw * 2, y1 - y0, 0.02], [0, (y0 + y1) / 2, 2.03]);                                // (the back of the hearth)
  for (const s of [-1, 1]) glowBox(p, EMBER, [0.02, y1 - y0, zf - 2.03], [s * (mw - 0.012), (y0 + y1) / 2, (2.03 + zf) / 2]);   // (its sides)
  glowBox(p, EMBER, [mw * 2, 0.02, zf - 2.03], [0, y1 - 0.012, (2.03 + zf) / 2]);                     // (its roof)
  glowBox(p, WHITE_HOT, [mw * 2 - 0.04, 0.05, zf - 2.08], [0, y0 + 0.04, (2.05 + zf) / 2]);           // (the melt on the hearth)
  p.light([0, 1.75, zf + 0.4], 20, FIRE, [0, 0, 1], 15); p.light([0, 1.0, zf + 0.8], 6, FIRE, null, 10); p.light([0, 2.6, zf + 0.5], 4, FIRE, [0, 0.6, 0.8], 10);
  haze(p, [0, 1.75, zf - 0.1], [0, 0.34, 0.94], { r: 0.6, spread: 0.32, length: 2.0, strength: 0.7 });
  // the plate over the mouth: a number, a warning sign, a stripe
  p.slab('white2', -0.85, 0.85, 3.6, 4.9, 1.45, 1.77, o9);
  digit(p, '1', 0.42, 4.3, 1.77, 0.8); warning(p, -0.36, 4.3, 1.77, 0.62);
  p.decal('hazard', 1.7, 0.18, [0, 3.72, 1.775], null, '#d9b23a');
  // pipes: two up from the cap to the ceiling, one down the side from the upper drum to the floor
  for (const x of [-0.55, 0.55]) { p.cyl('gun', 0.2, 1.05, [x, 6.5, -0.3], null, 16); p.cyl('black', 0.24, 0.08, [x, 6.1, -0.3], null, 16); }
  const px = 2.2 * Math.cos(2.4), pz = 2.2 * Math.sin(2.4);
  p.cyl('gun', 0.16, 4.8, [px, 2.7, pz], null, 14); p.cyl('gun', 0.16, 0.6, [px * 0.88, 5.0, pz * 0.88], [0, -2.4, PI / 2], 14);
  for (const y of [1.0, 2.4, 3.8]) p.box('black', [0.42, 0.1, 0.42], [px, y, pz], [0, -2.4, 0], o9);
  p.box('gun', [0.6, 0.9, 0.34], [2.12 * Math.cos(0.55), 1.7, 2.12 * Math.sin(0.55)], [0, Math.atan2(Math.cos(0.55), Math.sin(0.55)), 0], o9);
  // the floor: grating, a hazard ring round the furnace, curved rails across its front
  deck(p, -4.5, 4.5, -3.2, 4.6); hazardRing(p, 2.55); railArc(p, 3.4, 0.4, PI - 0.4, 0, 6);
  placed(p, thermalConsole, [-3.35, 0, 2.35], 0.95);
  if (!hall) placed(p, person, [2.6, 0, 3.7], -0.5);
}

// ── 2: one tower pouring into a ladle ─────────────────────────────────────────────────────────────────────────────
// a tower on four legs: a cone under it with the spout, glowing slots in its side, pipes up its side to the ceiling
function tower(p, x, r, num, slots = 3) {
  const L = r * 0.68;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.slab('black', x + sx * L - 0.15, x + sx * L + 0.15, 0, 2.7, sz * L - 0.15, sz * L + 0.15, o9);
  for (const sz of [-1, 1]) p.slab('black', x - L, x + L, 2.3, 2.42, sz * L - 0.08, sz * L + 0.08, o9);
  p.lathe(IRON, [[0.001, 2.0], [0.2, 2.02], [0.35, 2.25], [r - 0.06, 2.72], [r, 2.86], [r, 6.25], [r * 0.7, 6.6], [r * 0.7, 6.95], [0.001, 6.97]], 36, [x, 0, 0]);
  for (let y = 3.3; y < 6.2; y += 0.8) p.lathe('black', [[r - 0.02, y], [r + 0.03, y], [r + 0.03, y + 0.08], [r - 0.02, y + 0.08]], 36, [x, 0, 0]);
  p.cyl('black', 0.16, 0.3, [x, 1.95, 0], null, 14);
  for (let k = 0; k < slots; k++) {
    const a = PI / 2 + (k - (slots - 1) / 2) * 0.55, cx = x + (r + 0.005) * Math.cos(a), cz = (r + 0.005) * Math.sin(a), ry = Math.atan2(Math.cos(a), Math.sin(a));
    for (const y of [3.75, 5.2]) { p.box('black', [0.2, 1.0, 0.05], [cx, y, cz], [0, ry, 0], { r: 0.01, cell: 9, loops: [] }); glowBox(p, EMBER, [0.08, 0.86, 0.05], [x + (r + 0.03) * Math.cos(a), y, (r + 0.03) * Math.sin(a)], [0, ry, 0]); }
  }
  for (const a of [0.45, PI - 0.45, -PI / 2]) p.cyl('rail', 0.09, 4.2, [x + (r + 0.14) * Math.cos(a), 4.85, (r + 0.14) * Math.sin(a)], null, 10);
  if (num) { p.slab('white2', x - 0.45, x + 0.45, 4.0, 4.95, r - 0.12, r + 0.05, o9); digit(p, num, x, 4.47, r + 0.05, 0.72); }
}
// the stream of melt from a spout at height y1 down to a surface at y0, and its glow
function pour(p, x, z, y1, y0) {
  glowBox(p, WHITE_HOT, [0.13, y1 - y0, 0.13], [x, (y0 + y1) / 2, z], [0, PI / 4, 0]);
  p.light([x, y0 + 0.35, z + 0.3], 8, FIRE, null, 10); p.light([x, (y0 + y1) / 2, z + 0.5], 5, FIRE, [0, 0, 1], 10);
  haze(p, [x, y1, z], [0, -1, 0], { r: 0.1, spread: 0.28, length: y1 - y0, strength: 0.9 });
  haze(p, [x, y0, z], [0, 1, 0], { r: 0.45, spread: 0.3, length: 1.6, strength: 0.45 });
}
// a round tub that takes the melt (a ladle on a cart, or a fixed receiver), its top at about 1 m
function tub(p, x, z, r, cart) {
  const yb = cart ? 0.32 : 0;
  p.lathe('black', [[0.001, yb], [r * 0.8, yb], [r, yb + 0.7], [r + 0.06, yb + 0.72], [r + 0.06, yb + 0.8], [r - 0.06, yb + 0.8], [r - 0.06, yb + 0.6], [0.001, yb + 0.6]], 28, [x, 0, z]);
  coreDisc(p, HOT, r - 0.07, yb + 0.66, x, z, 28); coreDisc(p, WHITE_HOT, 0.16, yb + 0.67, x, z, 12);
  if (cart) {
    p.slab('yellow', x - r - 0.25, x + r + 0.25, 0.12, 0.32, z - r * 0.8, z + r * 0.8, o9);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl('black', 0.12, 0.1, [x + sx * (r + 0.05), 0.12, z + sz * r * 0.55], [0, 0, PI / 2], 12);
    for (const sx of [-1, 1]) p.cyl('gun', 0.08, 0.3, [x + sx * (r + 0.12), yb + 0.5, z], [0, 0, PI / 2], 10);
  }
}
// a grating platform at height y over x0..x1, z0..z1 on four posts, rails on the sides listed, a stair down toward +z
function platform(p, x0, x1, z0, z1, y, sides, stair) {
  floorQuad(p, 'grating', x0, x1, z0, z1, y);
  p.slab('black', x0, x1, y - 0.16, y - 0.005, z0, z1, o9);
  for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) p.slab('black', x - 0.07, x + 0.07, 0, y - 0.16, z - 0.07, z + 0.07, o9);
  for (const s of sides) railLine(p, ...s, y, 2);
  if (stair) {
    const [sx0, sx1] = stair, n = Math.round(y / 0.25), run = 0.28;
    for (let i = 0; i < n; i++) p.slab('dark', sx0, sx1, y - (i + 1) * (y / n) - 0.04, y - (i + 1) * (y / n), z1 + i * run, z1 + (i + 1) * run, { r: 0.01, cell: 9, loops: [] });
    for (const x of [sx0 - 0.04, sx1 + 0.04]) p.box('black', [0.06, 0.18, Math.hypot(n * run, y) + 0.1], [x, y / 2, z1 + n * run / 2], [Math.atan2(y, n * run), 0, 0], o9);
  }
}
function furnacePour(p, hall) {
  tower(p, 0, 1.55, '1', 3); tub(p, 0, 0, 0.62, true); pour(p, 0, 0, 1.82, 0.99);
  for (const x of [-0.3, 0.3]) p.slab('black', x - 0.04, x + 0.04, 0, 0.012, 0, 4.4, { r: 0.004, cell: 9, loops: [] });   // (the cart's rails, out to the casting line)
  platform(p, -4.3, -1.75, -1.7, 1.7, 2.3, [[[-4.3, -1.7], [-4.3, 1.7]], [[-4.3, -1.7], [-1.75, -1.7]], [[-3.25, 1.7], [-1.75, 1.7]]], [-4.2, -3.35]);
  deck(p, -4.5, 4.5, -3.2, 4.6); hazardRing(p, 1.4);
  placed(p, thermalConsole, [3.3, 0, 1.0], 1.2);
  if (!hall) placed(p, person, [2.4, 0, 3.4], -0.4);
}

// ── 3: two towers (his first picture) ─────────────────────────────────────────────────────────────────────────────
function furnaceTwo(p, hall) {
  for (const [x, n] of [[-2.25, '1'], [2.25, '2']]) { tower(p, x, 1.2, n, 3); tub(p, x, 0, 0.55, false); pour(p, x, 0, 1.82, 0.66); hazardRing(p, 1.1, x, 0); }
  platform(p, -4.4, 4.4, -2.75, -1.45, 2.3, [[[-4.4, -2.75], [4.4, -2.75]], [[-4.4, -1.45], [3.35, -1.45]], [[-4.4, -2.75], [-4.4, -1.45]]], [3.45, 4.3]);
  for (const x of [-2.25, 2.25]) floorDecal(p, 'hazard', 1.6, 0.36, x, 1.2, 0, '#d9b23a', 0.018);
  deck(p, -4.6, 4.6, -3.2, 4.6);
  placed(p, thermalConsole, [0, 0, 2.6], 0);
  if (!hall) placed(p, person, [3.7, 0, 2.6], -0.3);
}

// ── 4: a low crucible under a hood ────────────────────────────────────────────────────────────────────────────────
function furnaceHood(p, hall) {
  p.lathe(IRON, [[0.001, 0], [1.95, 0], [1.95, 1.12], [2.08, 1.16], [2.08, 1.34], [1.5, 1.34], [1.5, 1.05], [0.001, 1.05]], 40);
  for (const y of [0.25, 0.75]) p.lathe('black', [[1.93, y], [1.99, y], [1.99, y + 0.1], [1.93, y + 0.1]], 40);
  coreDisc(p, HOT, 1.49, 1.07, 0, 0, 40); coreDisc(p, WHITE_HOT, 0.75, 1.085, 0, 0, 24);
  p.add('core', put(lathe2([[1.49, 1.34], [1.49, 1.08]], 40), [0, 0, 0]), EMBER);   // (the melt's glow up the crucible's inside)
  p.slab(IRON, -0.35, 0.35, 1.0, 1.3, 1.9, 2.55, o9); glowBox(p, HOT, [0.3, 0.02, 0.6], [0, 1.29, 2.22]);   // (the pouring lip)
  // the hood: a broad cone over it on its duct to the ceiling, lit orange from below
  p.lathe('gun', [[2.25, 3.3], [2.32, 3.36], [2.32, 3.58], [0.78, 4.92], [0.78, 7.0], [0.68, 7.0], [0.68, 4.86], [2.2, 3.52], [2.2, 3.3]], 40);
  p.lathe('black', [[2.33, 3.3], [2.37, 3.3], [2.37, 3.42], [2.33, 3.42]], 40);
  for (const a of [0.8, 2.35, 3.9, 5.45]) p.box('black', [0.08, 3.8, 0.08], [2.1 * Math.cos(a), 5.2, 2.1 * Math.sin(a)], [0, 0, 0], o9);
  p.light([0, 1.5, 0], 16, FIRE, [0, 1, 0], 12); p.light([0, 1.7, 1.2], 8, FIRE, null, 11);
  haze(p, [0, 1.12, 0], [0, 1, 0], { r: 1.25, spread: 0.12, length: 2.3, strength: 0.55 });
  railArc(p, 2.85, PI / 2 + 0.38, PI / 2 + 2 * PI - 0.38, 0, 12); hazardRing(p, 2.45);
  deck(p, -4.5, 4.5, -3.4, 4.6);
  placed(p, thermalConsole, [-3.2, 0, 2.6], 0.8);
  if (!hall) placed(p, person, [2.4, 0, 3.4], -0.5);
}

const LOOKS = { 1: furnaceHis, 2: furnacePour, 3: furnaceTwo, 4: furnaceHood };
export function furnaceOption(p, v) { (LOOKS[v[0]] || furnaceHis)(p, v.endsWith(' in the hall')); }

export const OPTIONS2 = {
  furnaceopt: { name: 'Furnace (options to choose from)', group: 'Options', at: 'point', variants: ['1 like the picture', '2 pouring tower', '3 two towers', '4 hooded crucible', '1 in the hall', '2 in the hall', '3 in the hall', '4 in the hall'], foot: [9, 7, 9], build: furnaceOption },
};
