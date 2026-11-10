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
//   craneopt     the Miner hangar's ceiling crane (9 m up): 8 m of its track with its carriage lifting a canister
//     '1 monorail hoist'   a hangar's monorail: an I-beam, a trolley on its bottom flange, a yellow chain hoist, a hook
//                          block and two lifting straps round the canister
//     '2 twin-rail spreader'  two rails, a wide trolley, a spreader beam whose end clamps grip the canister's ends
//     '3 arm on a track'   an enclosed track with a light strip, a carriage with a jointed arm and four fingers
//     '4 telescopic mast'  a stiff mast of three sliding sections down to a round lifting magnet with a ring of light
//   scanneropt   the medical centre's big scanner (2.2 wide, 2.4 tall, 1.9 deep, its table 3.1 m long), its back on a
//                stretch of wall: '1 ring' (the classic: a rounded housing, a round bore with a ring of light), '2 open'
//                (two great round plates above and below), '3 thin ring' (a slim ring on a low base), '4 pod' (a
//                capsule under a clear lid, an arch of light over it)
//   socketopt    the wall sockets the canisters are emptied through: one in use, one empty, on a stretch of wall:
//                '1 clamp collar', '2 cradle and valve', '3 floor well' (the canister stands upright), '4 hatch'
import { bevelBox, put, circle, bend, line, cylinder, rrect, lathe as lathe2 } from './geo.js';
import { pulseLine } from './shipparts/cabin/medical.js';
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
  [0.34, 0.62, 0.46, 0.72, 0.4, 0.55].forEach((h, i) => glowBox(p, i % 2 ? HOT : WHITE_HOT, [0.07, h, 0.04], [-0.55 + i * 0.22, y0 + 0.06 + h / 2, 2.1 + (i % 3) * 0.06]));   // (tongues of flame)
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
  // a ladder up the back-left to the ring walkway
  { const a = 3.75; placed(p, (q) => { for (const x of [-0.24, 0.24]) q.slab('black', x - 0.03, x + 0.03, 0, 4.3, -0.03, 0.03, o9); for (let y = 0.3; y < 3.4; y += 0.3) q.cyl('yellow', 0.02, 0.48, [0, y, 0], [0, 0, PI / 2], 8); }, [2.3 * Math.cos(a), 0, 2.3 * Math.sin(a)], Math.atan2(Math.cos(a), Math.sin(a))); }
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


// ── the ore canister, as the built Miner carries it (0.94 m across, 2.18 m long), lying along x, its middle at `at` ──
const CAN_R = 0.47, CAN_L = 2.18;
function canister(p, at, ry = 0, upright = false) {
  placed(p, (q) => {
    q.cyl('white2', CAN_R, CAN_L - 0.24, [0, 0, 0], [0, 0, PI / 2], 28);
    for (const s of [-1, 1]) {
      q.cyl('black', CAN_R + 0.03, 0.1, [s * (CAN_L / 2 - 0.17), 0, 0], [0, 0, PI / 2], 28);
      q.lathe('gun', [[CAN_R - 0.02, 0], [CAN_R - 0.08, 0.06], [0.22, 0.1], [0.001, 0.11]], 24, [0, 0, 0]).rotateZ(-s * PI / 2).translate(s * (CAN_L / 2 - 0.12), 0, 0);
    }
    q.cyl('yellow', CAN_R + 0.006, 0.18, [0.35, 0, 0], [0, 0, PI / 2], 28);
    if (upright) for (const part of q.parts) part.geo.rotateZ(PI / 2);
  }, at, ry);
}
// a bar of section w x d from a to b in the x-y plane, at depth z
function bar(p, surf, a, b, w, d, z = 0) { const dx = b[0] - a[0], dy = b[1] - a[1]; p.box(surf, [w, Math.hypot(dx, dy), d], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [0, 0, -Math.atan2(dx, dy)], { r: 0.004, cell: 9, loops: [] }); }
// an I-beam along x from x0 to x1, its top at y (0.3 deep, 0.2 wide flanges)
function ibeam(p, x0, x1, y, z = 0, surf = 'black') {
  p.slab(surf, x0, x1, y - 0.03, y, z - 0.1, z + 0.1, o9); p.slab(surf, x0, x1, y - 0.3, y - 0.27, z - 0.1, z + 0.1, o9);
  p.slab(surf, x0, x1, y - 0.27, y - 0.03, z - 0.012, z + 0.012, o9);
}
// a hanger from a roof plate at 11 m down to y, at (x, z)
const hanger = (p, x, z, y) => { p.cyl('black', 0.03, 11 - y, [x, (11 + y) / 2, z], null, 8); p.slab('black', x - 0.15, x + 0.15, 10.96, 11.0, z - 0.15, z + 0.15, o9); };
// a short stretch of the hangar's roof at 11 m (so the hangers have something to hang from)
const roofBit = (p, x0, x1, z0, z1) => p.slab('dark', x0, x1, 11.0, 11.12, z0, z1, { r: 0, cell: 9, loops: [] });

// ── THE CRANE: a ceiling monorail that carries the Miner's canisters (9 m up in the hangar) ──────────────────────────
// each sketch: 8 m of its track (along x), its carriage over the middle with a canister lifted to about 3 m
const TY = 9.3;   // (the track's top)
function craneHook(p) {
  // 1: a hangar's monorail hoist: an I-beam, a trolley riding its bottom flange, a yellow chain hoist, a hook block and
  // two lifting straps round the canister
  roofBit(p, -4.2, 4.2, -0.6, 0.6); ibeam(p, -4, 4, TY); for (const x of [-3.2, 0.0, 3.2]) hanger(p, x, 0, TY);
  for (const s of [-1, 1]) { p.slab('gun', -0.45, 0.45, TY - 0.55, TY - 0.08, s * 0.16 - 0.03, s * 0.16 + 0.03, o9); for (const x of [-0.28, 0.28]) p.cyl('black', 0.07, 0.05, [x, TY - 0.24, s * 0.12], [PI / 2, 0, 0], 12); }
  p.slab('yellow', -0.35, 0.35, TY - 1.25, TY - 0.55, -0.28, 0.28, o9); p.cyl('black', 0.16, 0.62, [0, TY - 0.9, 0], [PI / 2, 0, 0], 16);
  p.slab('black', -0.36, 0.36, TY - 1.3, TY - 1.22, -0.3, 0.3, o9); p.decal('hazard', 0.6, 0.12, [0, TY - 0.7, 0.285], null, '#d9b23a');
  const yb = 3.0 + CAN_R + 0.75;
  for (const x of [-0.06, 0.06]) p.cyl('chrome', 0.014, TY - 1.3 - yb, [x, (TY - 1.3 + yb) / 2, 0], null, 6);
  p.slab('yellow', -0.18, 0.18, yb - 0.3, yb, -0.1, 0.1, o9); p.cyl('black', 0.05, 0.3, [0, yb - 0.38, 0], null, 10);
  // the straps: from the hook out to two loops under the canister
  for (const s of [-1, 1]) {
    const x = s * 0.6; bar(p, 'orange', [0, yb - 0.5], [x, 3.0 + CAN_R], 0.07, 0.015);
    const ring = p.lathe('orange', [[CAN_R + 0.01, -0.04], [CAN_R + 0.03, -0.04], [CAN_R + 0.03, 0.04], [CAN_R + 0.01, 0.04]], 28); put(ring, [x, 3.0, 0], [0, 0, PI / 2]);
  }
  canister(p, [0, 3.0, 0]);
}
function craneSpreader(p) {
  // 2: twin rails and a wide trolley: two cables down to a spreader beam whose end clamps grip the canister's ends
  roofBit(p, -4.2, 4.2, -1.2, 1.2); for (const z of [-0.8, 0.8]) { ibeam(p, -4, 4, TY, z); for (const x of [-3.2, 3.2]) hanger(p, x, z, TY); }
  p.slab('yellow', -0.8, 0.8, TY - 0.75, TY - 0.32, -1.0, 1.0, o9); p.slab('black', -0.82, 0.82, TY - 0.8, TY - 0.72, -1.02, 1.02, o9);
  for (const z of [-0.8, 0.8]) for (const x of [-0.55, 0.55]) p.cyl('black', 0.09, 0.08, [x, TY - 0.24, z], [PI / 2, 0, 0], 12);
  p.cyl('black', 0.22, 1.5, [0, TY - 0.55, 0], [PI / 2, 0, 0], 18); p.decal('hazard', 1.4, 0.16, [0, TY - 0.5, 1.003], null, '#d9b23a');
  const ys = 3.0 + CAN_R + 0.5;
  for (const x of [-0.9, 0.9]) p.cyl('chrome', 0.016, TY - 0.8 - ys, [x, (TY - 0.8 + ys) / 2, 0], null, 6);
  p.slab('black', -1.45, 1.45, ys - 0.12, ys + 0.12, -0.14, 0.14, o9); p.slab('yellow', -1.4, 1.4, ys - 0.1, ys + 0.1, -0.15, 0.15, o9);
  for (const s of [-1, 1]) { p.slab('black', s * 1.3 - 0.1, s * 1.3 + 0.1, 3.0 - 0.1, ys - 0.1, -0.12, 0.12, o9); p.cyl('gun', 0.2, 0.12, [s * (CAN_L / 2 + 0.02), 3.0, 0], [0, 0, PI / 2], 16); }
  p.glowSlab('green', -0.3, 0.3, ys - 0.02, ys + 0.02, 0.15, 0.16);
  canister(p, [0, 3.0, 0]);
}
function craneArm(p) {
  // 3: an enclosed track (pale panels, a light strip under it) and a carriage with a jointed arm whose three fingers
  // close round the canister's middle
  roofBit(p, -4.2, 4.2, -0.8, 0.8);
  p.slab('white2', -4, 4, TY - 0.5, TY, -0.32, 0.32, o9); p.slab('black', -4, 4, TY - 0.56, TY - 0.5, -0.06, 0.06, o9); p.glowSlab('blue', -3.9, 3.9, TY - 0.565, TY - 0.56, -0.025, 0.025);
  for (const x of [-3.2, 3.2]) hanger(p, x, 0, TY);
  p.slab('white2', -0.6, 0.6, TY - 1.0, TY - 0.5, -0.38, 0.38, o9); p.slab('black', -0.62, 0.62, TY - 1.05, TY - 0.95, -0.4, 0.4, o9);
  p.cyl('gun', 0.22, 0.3, [0, TY - 1.2, 0], null, 18);
  // shoulder, upper arm down and out, elbow, forearm back in, wrist over the canister
  const sh = [0, TY - 1.35, 0], el = [0.9, 6.0, 0], wr = [0, 3.0 + CAN_R + 0.55, 0];
  const seg = (a, b, r) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d); p.cyl('white2', r, L, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], [0, 0, -Math.atan2(d[0], d[1])], 16); };
  seg(sh, el, 0.17); seg(el, wr, 0.14);
  for (const j of [sh, el]) p.cyl('black', 0.24, 0.42, j, [PI / 2, 0, 0], 20);
  p.cyl('black', 0.2, 0.3, wr, null, 18); p.glowSlab('orange', -0.21, 0.21, wr[1] + 0.05, wr[1] + 0.08, -0.21, 0.21);
  p.slab('gun', -0.6, 0.6, wr[1] - 0.1, wr[1], -0.12, 0.12, o9);
  for (const dz of [-0.45, 0.45]) for (const ry of [-PI / 2, PI / 2]) placed(p, (q) => { q.box('gun', [0.09, 0.7, 0.12], [0, -0.3, CAN_R + 0.12], [-0.35, 0, 0], o9); q.box('gun', [0.09, 0.5, 0.1], [0, -0.75, CAN_R - 0.02], [0.5, 0, 0], o9); }, [wr[0], wr[1], dz], ry);
  canister(p, [0, 3.0, 0], PI / 2);
}
function craneMast(p) {
  // 4: a carriage with a stiff telescopic mast (three square sections) down to a round lifting plate whose glowing
  // ring holds the canister from above by magnet
  roofBit(p, -4.2, 4.2, -0.6, 0.6); ibeam(p, -4, 4, TY, 0, 'gun'); for (const x of [-3.2, 0.0, 3.2]) hanger(p, x, 0, TY);
  p.slab('orange', -0.7, 0.7, TY - 0.95, TY - 0.3, -0.45, 0.45, o9); p.slab('black', -0.72, 0.72, TY - 0.33, TY - 0.27, -0.47, 0.47, o9);
  const top = TY - 0.95, plate = 3.0 + CAN_R + 0.04;
  const secs = [[0.3, top, top - 2.0], [0.24, top - 1.9, top - 3.6], [0.18, top - 3.5, plate + 0.3]];
  for (const [w, y1, y0] of secs) { p.slab('yellow', -w / 2, w / 2, y0, y1, -w / 2, w / 2, o9); p.slab('black', -w / 2 - 0.02, w / 2 + 0.02, y0, y0 + 0.08, -w / 2 - 0.02, w / 2 + 0.02, o9); }
  p.lathe('gun', [[0.001, plate + 0.3], [0.5, plate + 0.22], [0.62, plate + 0.08], [0.62, plate], [0.001, plate]], 32);
  p.add('glow', put(cylinder(0.64, 0.025, [0, plate + 0.04, 0], 32), [0, 0, 0]), 'blue');
  canister(p, [0, 3.0, 0], PI / 2);
}
const CRANES = { 1: craneHook, 2: craneSpreader, 3: craneArm, 4: craneMast };
export function craneOption(p, v) {
  (CRANES[v[0]] || craneHook)(p);
  deck(p, -4.5, 4.5, -3.0, 3.0); placed(p, person, [2.4, 0, 1.6], -0.5);
}

// ── THE BIG SCANNER (the medical centre's MRI-type scanner: a magnet 2.2 wide, 2.4 tall, 1.9 deep, its bore 0.7 m across,
// its table 3.1 m long toward the way in, +z). Each sketch stands with its back on z = 0 (a wall) ──────────────────
const MAG = { w: 2.2, h: 2.4, d: 1.9, bore: 0.35, by: 1.15 };
function scanTable(p, z0, len, y = 0.82) {
  p.slab('white2', -0.42, 0.42, 0, y - 0.12, z0 + len - 1.3, z0 + len - 0.2, o9);   // (its pedestal, at the room end)
  p.slab('band', -0.38, 0.38, y - 0.12, y - 0.04, z0, z0 + len, o9);
  p.slab({ c: '#2b3a52', r: 0.8, m: 0, w: 0 }, -0.3, 0.3, y - 0.04, y + 0.02, z0 + 0.3, z0 + len - 0.1, { r: 0.03, cell: 9, loops: [] });
}
function scanRing(p) {
  // 1: the classic: a pale rounded housing with a round bore, a teal ring of light at its mouth, a long table into it
  const g = p.extrude('white2', rrect(MAG.w, MAG.h, 0.5, 6, 0, MAG.h / 2).pts, MAG.d, 0.06, { holes: [circle(MAG.bore, 40).pts.map(([x, y]) => [x, y + MAG.by]).reverse()], curve: 24 }); put(g, [0, 0, 0.05]);
  p.slab('band', -MAG.w / 2 + 0.1, MAG.w / 2 - 0.1, 0, 0.18, 0.1, MAG.d, o9);
  const ring = p.lathe('black', [[MAG.bore + 0.06, 0], [MAG.bore + 0.2, 0], [MAG.bore + 0.2, 0.03], [MAG.bore + 0.06, 0.03]], 40); put(ring, [0, MAG.by, MAG.d + 0.06], [PI / 2, 0, 0]);
  p.add('glow', put(lathe2([[MAG.bore + 0.19, 0], [MAG.bore + 0.07, 0]], 40), [0, MAG.by, MAG.d + 0.1], [PI / 2, 0, 0]), [0.25, 2.6, 2.3]);
  p.add('glow', put(cylinder(MAG.bore - 0.005, 0.01, [0, 0, 0], 40), [0, MAG.by, 0.4], [PI / 2, 0, 0]), [0.2, 1.4, 1.3]);
  pulseLine(p, -0.5, 0.5, 2.05, MAG.d + 0.07, 0.12);
  scanTable(p, MAG.d - 0.9, 3.1 + 0.9);
  p.light([0, 1.3, MAG.d + 0.6], 1.2, [0.5, 1, 0.95], [0, 0, 1], 4);
}
function scanOpen(p) {
  // 2: open: two great round plates above and below the patient, a pillar behind joining them, open on three sides
  p.lathe('white2', [[0.001, 0], [1.1, 0], [1.15, 0.12], [1.15, 0.55], [1.05, 0.62], [0.001, 0.62]], 40, [0, 0, 1.1]);
  p.lathe('white2', [[0.001, 1.65], [1.05, 1.65], [1.15, 1.72], [1.15, 2.2], [1.05, 2.4], [0.001, 2.4]], 40, [0, 0, 1.1]);
  p.slab('white2', -0.75, 0.75, 0.3, 2.2, 0.02, 0.6, { r: 0.08, cell: 1.5, loops: [] });
  p.add('glow', cylinder(0.9, 0.01, [0, 1.645, 1.1], 40), [0.25, 2.6, 2.3]); p.add('glow', cylinder(0.9, 0.01, [0, 0.625, 1.1], 40), [0.2, 1.6, 1.4]);
  pulseLine(p, -0.45, 0.45, 2.0, 1.25 + 0.0, 0.1);
  scanTable(p, 0.5, 3.1 + 0.6, 0.95);
  p.light([0, 1.2, 1.6], 1.2, [0.5, 1, 0.95], null, 4);
}
function scanThin(p) {
  // 3: a slim ring on a low base, bands of light round it, the table passing through it
  const R = 1.05, T = 0.24, cy = 1.2, zc = 0.9;
  const ring = p.lathe('white2', [[R - T, -0.3], [R + T, -0.3], [R + T + 0.04, -0.2], [R + T + 0.04, 0.2], [R + T, 0.3], [R - T, 0.3], [R - T - 0.03, 0.2], [R - T - 0.03, -0.2], [R - T, -0.3]], 56); put(ring, [0, cy, zc], [PI / 2, 0, 0]);
  for (const dz of [-0.31, 0.31]) p.add('glow', put(lathe2([[R - T + 0.1, 0], [R - T + 0.02, 0]], 56), [0, cy, zc + dz], [dz < 0 ? -PI / 2 : PI / 2, 0, 0]), [0.25, 2.6, 2.3]);
  p.slab('band', -0.55, 0.55, 0, 0.25, zc - 0.45, zc + 0.45, o9); p.slab('white2', -0.35, 0.35, 0.25, cy - R - T + 0.05, zc - 0.25, zc + 0.25, o9);
  pulseLine(p, -0.4, 0.4, cy + R + 0.05, zc + 0.31, 0.1);
  scanTable(p, -0.4, 3.1 + 1.3);
  p.light([0, 1.3, zc + 0.8], 1.2, [0.5, 1, 0.95], [0, 0, 1], 4);
}
function scanPod(p) {
  // 4: a closed pod: the patient lies in a capsule under a clear lid, an arch of light slides along over it
  p.slab('white2', -0.6, 0.6, 0, 0.5, 0.2, 3.3, { r: 0.12, cell: 1.5, loops: [] });
  p.slab('band', -0.62, 0.62, 0.5, 0.62, 0.15, 3.35, o9);
  p.glass(1.0, 2.9, [0, 0.95, 1.75], [-PI / 2, 0, 0]);
  for (const s of [-1, 1]) p.slab('white2', s * 0.62 - 0.08, s * 0.62 + 0.08, 0.6, 1.0, 0.2, 3.3, o9);
  const arch = p.lathe('white2', [[1.15, -0.18], [1.32, -0.18], [1.32, 0.18], [1.15, 0.18], [1.15, -0.18]], 48); put(arch, [0, 0, 2.2], [PI / 2, 0, 0]);
  p.add('glow', put(lathe2([[1.16, 0], [1.2, 0]], 48), [0, 0, 2.39], [PI / 2, 0, 0]), [0.25, 2.6, 2.3]);
  p.slab('white2', -0.5, 0.5, 0, 1.6, 0.0, 0.25, o9); pulseLine(p, -0.35, 0.35, 1.3, 0.255, 0.1);
  p.light([0, 1.3, 2.2], 1.2, [0.5, 1, 0.95], null, 4);
}
const SCANS = { 1: scanRing, 2: scanOpen, 3: scanThin, 4: scanPod };
export function scannerOption(p, v) {
  (SCANS[v[0]] || scanRing)(p);
  p.slab('white2', -2.6, 2.6, 0, 3, -0.3, -0.05, { r: 0, cell: 9, loops: [] });   // (a stretch of the room's back wall)
  floorQuad(p, 'deck', -2.6, 2.6, -0.05, 5.2, 0.006);
  placed(p, person, [2.0, 0, 2.7], -0.9);
}

// ── THE WALL SOCKETS where the Miner's canisters are emptied into the crusher: a stretch of the hangar's wall with
// one socket in use (a canister plugged in) and one empty ─────────────────────────────────────────────────────────
function sockCollar(p, x, y, used) {
  // 1: a round collar with four clamps and a ring of light (green: in use; amber: empty, its shutter shut)
  p.lathe('gun', [[CAN_R + 0.06, 0], [CAN_R + 0.3, 0], [CAN_R + 0.3, 0.18], [CAN_R + 0.2, 0.26], [CAN_R + 0.06, 0.26], [CAN_R + 0.06, 0]], 36).rotateX(PI / 2).translate(x, y, 0);
  p.add('glow', put(lathe2([[CAN_R + 0.2, 0], [CAN_R + 0.12, 0]], 36), [x, y, 0.27], [PI / 2, 0, 0]), used ? 'green' : 'amber');
  for (let k = 0; k < 4; k++) { const a = PI / 4 + k * PI / 2; p.box('yellow', [0.16, 0.2, 0.3], [x + Math.cos(a) * (CAN_R + 0.12), y + Math.sin(a) * (CAN_R + 0.12), 0.32], [0, 0, a], o9); }
  if (!used) { p.add('solid', put(cylinder(CAN_R + 0.06, 0.03, [0, 0, 0], 36), [x, y, 0.06], [PI / 2, 0, 0]), 'black'); for (let k = 0; k < 6; k++) p.box('dark', [0.04, CAN_R * 1.9, 0.02], [x, y, 0.08], [0, 0, k * PI / 6], { r: 0.003, cell: 9, loops: [] }); }
}
function sockCradle(p, x, y, used) {
  // 2: a cradle on two brackets the canister lies in, its end pushed into a valve block on the wall
  p.slab('gun', x - 0.5, x + 0.5, y - 0.55, y + 0.55, 0, 0.35, o9); p.cyl('black', 0.3, 0.12, [x, y, 0.41], [PI / 2, 0, 0], 24);
  p.glowSlab(used ? 'green' : 'amber', x - 0.35, x - 0.2, y + 0.38, y + 0.46, 0.35, 0.36);
  for (const z of [0.9, 2.1]) { p.slab('yellow', x - 0.08, x + 0.08, 0, y - CAN_R - 0.05, z - 0.08, z + 0.08, o9); p.lathe('yellow', [[CAN_R + 0.02, -0.06], [CAN_R + 0.08, -0.06], [CAN_R + 0.08, 0.06], [CAN_R + 0.02, 0.06]], 24).rotateX(PI / 2).translate(x, y, z); }
}
function sockWell(p, x, y, used) {
  // 3: a well in the floor the canister stands upright in; a pump head on the wall over it
  p.lathe('gun', [[CAN_R + 0.05, 0], [CAN_R + 0.35, 0], [CAN_R + 0.35, 0.12], [CAN_R + 0.05, 0.12]], 36, [x, 0, 1.0]);
  p.add('solid', cylinder(CAN_R + 0.05, 0.02, [x, 0.02, 1.0], 36), 'black');
  hazardRing(p, CAN_R + 0.55, x, 1.0);
  p.slab('gun', x - 0.35, x + 0.35, 2.5, 3.1, 0, 0.5, o9); p.cyl('black', 0.1, 0.4, [x, 2.3, 0.35], null, 12);
  p.glowSlab(used ? 'green' : 'amber', x - 0.25, x + 0.25, 2.95, 3.0, 0.5, 0.51);
}
function sockHatch(p, x, y, used) {
  // 4: a square hatch in the wall with a lit frame: the canister slides right in; empty, its shutter is down
  const h = CAN_R + 0.15;
  for (const [a, b, c, d] of [[-h - 0.15, -h, -h - 0.15, h + 0.15], [h, h + 0.15, -h - 0.15, h + 0.15], [-h, h, h, h + 0.15], [-h, h, -h - 0.15, -h]]) p.slab('gun', x + a, x + b, y + c, y + d, 0, 0.18, o9);
  p.glowSlab(used ? 'green' : 'amber', x - h, x + h, y + h + 0.02, y + h + 0.05, 0.18, 0.19);
  p.slab('black', x - h, x + h, y - h, y + h, 0.0, 0.02, o9);
  if (!used) for (let k = 0; k < 5; k++) p.slab('dark', x - h + 0.02, x + h - 0.02, y - h + k * 0.25 + 0.02, y - h + k * 0.25 + 0.23, 0.02, 0.05, { r: 0.01, cell: 9, loops: [] });
  p.decal('hazard', 2 * h + 0.3, 0.14, [x, y - h - 0.25, 0.005], null, '#d9b23a');
}
const SOCKS = { 1: sockCollar, 2: sockCradle, 3: sockWell, 4: sockHatch };
export function socketOption(p, v) {
  const k = v[0], f = SOCKS[k] || sockCollar, y = k === '3' ? 0 : 0.85;
  p.slab('white2', -3.2, 3.2, 0, 3.0, -0.25, 0, { r: 0, cell: 9, loops: [] });   // (a stretch of the hangar's wall)
  p.slab('black', -3.2, 3.2, 0, 0.12, -0.25, 0.04, o9);
  floorQuad(p, 'tread', -3.2, 3.2, 0, 4.4, 0.006);
  f(p, -1.4, y, true); f(p, 1.4, y, false);
  if (k === '3') canister(p, [-1.4, CAN_L / 2 + 0.02, 1.0], 0, true);
  else canister(p, [-1.4, y, (k === '4' ? 0.6 : k === '2' ? 1.5 : 0.26 + CAN_L / 2)], PI / 2);
  placed(p, person, [2.4, 0, 3.0], -0.5);
}


export const OPTIONS2 = {
  furnaceopt: { name: 'Furnace (options to choose from)', group: 'Options', at: 'point', variants: ['1 like the picture', '2 pouring tower', '3 two towers', '4 hooded crucible', '1 in the hall', '2 in the hall', '3 in the hall', '4 in the hall'], foot: [9, 7, 9], build: furnaceOption },
  craneopt: { name: 'Crane (options to choose from)', group: 'Options', at: 'point', variants: ['1 monorail hoist', '2 twin-rail spreader', '3 arm on a track', '4 telescopic mast'], foot: [9, 11, 6], build: craneOption },
  scanneropt: { name: 'Big scanner (options to choose from)', group: 'Options', at: 'point', variants: ['1 ring', '2 open', '3 thin ring', '4 pod'], foot: [5.2, 3, 5.4], build: scannerOption },
  socketopt: { name: 'Wall socket (options to choose from)', group: 'Options', at: 'point', variants: ['1 clamp collar', '2 cradle and valve', '3 floor well', '4 hatch'], foot: [6.4, 3, 4.4], build: socketOption },
};
