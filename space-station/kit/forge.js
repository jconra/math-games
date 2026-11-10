// THE SMELTER'S FORGE: the game's maker's pick from the furnace options ("The two towers is probably my favorite of
// those. I hope the forge area is dark so the molten metal reall glows"), built to his first reference picture: two
// big upright towers of worn dark metal, stencilled 1 and 2, pipes up their sides, glowing slots, each pouring molten
// metal from its underside as a glowing column into a ladle on a cart; a grating catwalk at the pour's height with
// yellow and black rails, a hot-surfaces plate by each ladle, and the thermal console with its live screens.
//
//   forge      a POINT piece for the smelter's hall (12 x 12 m inside, 11 m high), its middle on the hall's middle,
//              its front (+z) toward the crusher (south), +x toward the lobby's hatch (east). 'two towers'.
//
// In the piece's frame (metres): the towers stand at x -2.4 and +2.2, z -1.6; the ladles under them, on rails running
// north (-z) to the casting line; the catwalk runs along x from -5.7 to 4.0 at z 0.6..1.8, 2.6 m up, its stair down
// the hall's west wall (x -5.7..-4.7) toward the north; the console at x 4.4, z -1.6, its screens facing east.
// The melt (pours, slots, ladle surfaces) is the kit's moving 'melt' material (kit/melt.js): one draw for all of it.
// The light it throws is baked (the pools on the floor, the towers' undersides lit from below), and each pour carries
// two beams of lit haze (kit/beams.js): down along the stream and up out of the ladle.
import * as THREE from 'three';
import { cylinder, put, circle, line } from './geo.js';
import { floorQuad } from './shell.js';
import { floorDecal } from './station2.js';
import { placed, glowBox, haze, railLine, digit, warning, thermalConsole, IRON, HOT, WHITE_HOT, EMBER, FIRE, o9 } from './station2-options.js';

const PI = Math.PI;
// (worn dark metal: the towers' plates, darker bands, a rusty brown for the oldest parts)
const STEEL = { c: '#5d5f64', r: 0.56, m: 0.55, w: 1.0 }, SOOT = { c: '#36383c', r: 0.7, m: 0.4, w: 1.0 }, RUST = { c: '#5a4636', r: 0.75, m: 0.25, w: 1.0 };
const thin = { r: 0.004, cell: 9, loops: [] };
export const FORGE = { towers: [[-2.4, -1.6], [2.2, -1.6]], r: 1.55, spout: 3.15, body: [4.1, 9.4], ladleTop: 1.0, walk: { x: [-5.7, 4.0], z: [0.6, 1.8], y: 2.6 } };

// a yellow rail with black bands along it, from a to b (each [x, y, z]): a black sleeve on every other half metre
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function bandedRail(p, a, b, r = 0.03) {
  p.sweep('yellow', circle(r, 8), line(a, b, [0, 1, 0], 4));
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _d.length(), n = Math.floor(L / 0.5); _d.normalize(); _q.setFromUnitVectors(_up, _d);
  for (let i = 1; i < n; i += 2) {
    const t = (i + 0.5) / n, g = cylinder(r + 0.005, 0.24, [0, 0, 0], 8);
    g.applyQuaternion(_q); g.translate(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    p.add('solid', g, 'black');
  }
}

// ── one tower ─────────────────────────────────────────────────────────────────────────────────────────────────────
function tower(p, x, z, num) {
  const R = FORGE.r, [b0, b1] = FORGE.body, L = 1.1, at = [x, 0, z];
  // four legs, two at the back and one each side, braced at the back and the sides: open at the front, so the pour
  // and the ladle under it can be seen from the catwalk and the floor
  const legs = [[-L, -L], [L, -L], [-(L + 0.25), 0.35], [L + 0.25, 0.35]];
  for (const [lx, lz] of legs) { p.slab(SOOT, x + lx - 0.17, x + lx + 0.17, 0, b0 - 0.2, z + lz - 0.17, z + lz + 0.17, o9); p.slab('black', x + lx - 0.26, x + lx + 0.26, 0, 0.06, z + lz - 0.26, z + lz + 0.26, o9); }
  const brace = (a, b, y) => { const dx = b[0] - a[0], dz = b[1] - a[1]; p.box(SOOT, [0.18, 0.16, Math.hypot(dx, dz)], [x + (a[0] + b[0]) / 2, y + 0.08, z + (a[1] + b[1]) / 2], [0, Math.atan2(dx, dz), 0], o9); };
  for (const y of [1.25, b0 - 0.75]) { brace(legs[0], legs[1], y); brace(legs[0], legs[2], y); brace(legs[1], legs[3], y); }
  // the body: a cone under it down to the spout, the drum, a stepped cap
  p.lathe(STEEL, [[0.001, FORGE.spout + 0.05], [0.24, FORGE.spout + 0.07], [0.36, FORGE.spout + 0.3], [R - 0.08, b0 - 0.08], [R, b0], [R, b1], [R - 0.12, b1 + 0.1], [R * 0.72, b1 + 0.4], [R * 0.72, b1 + 0.62], [R * 0.5, b1 + 0.7], [0.001, b1 + 0.72]], 40, at);
  // bands round it (riveted hoops), a darker skirt, vertical seams between the plates
  for (let y = b0 + 0.35; y < b1 - 0.1; y += 0.95) p.lathe(SOOT, [[R - 0.02, y], [R + 0.045, y + 0.01], [R + 0.045, y + 0.13], [R - 0.02, y + 0.14]], 40, at);
  p.lathe(RUST, [[R - 0.01, b0], [R + 0.02, b0 + 0.02], [R + 0.02, b0 + 0.32], [R - 0.01, b0 + 0.34]], 40, at);
  for (let k = 0; k < 10; k++) {
    const a = (k + 0.5) / 10 * 2 * PI; if (Math.abs(Math.sin(a) - 1) < 0.15) continue;   // (none down its front, where the number is)
    p.box(SOOT, [0.06, b1 - b0 - 0.2, 0.03], [x + (R + 0.012) * Math.cos(a), (b0 + b1) / 2, z + (R + 0.012) * Math.sin(a)], [0, Math.atan2(Math.cos(a), Math.sin(a)), 0], thin);
  }
  // the spout and its glowing lip
  p.cyl('black', 0.22, 0.34, [x, FORGE.spout + 0.02, z], null, 16);
  p.add('melt', cylinder(0.12, 0.02, [x, FORGE.spout - 0.16, z], 16), WHITE_HOT);
  // the slots: narrow and tall, two rows, either side of the number, glowing from inside
  for (const a of [PI / 2 - 0.62, PI / 2 + 0.62, PI / 2 - 1.15, PI / 2 + 1.15]) for (const y of [b0 + 1.4, b0 + 3.2]) {
    const ry = Math.atan2(Math.cos(a), Math.sin(a)), c = [x + R * Math.cos(a), y, z + R * Math.sin(a)];
    p.box('black', [0.24, 1.2, 0.08], c, [0, ry, 0], thin);
    glowBox(p, HOT, [0.1, 1.04, 0.06], [x + (R + 0.035) * Math.cos(a), y, z + (R + 0.035) * Math.sin(a)], [0, ry, 0]);
    p.light([x + (R + 0.5) * Math.cos(a), y, z + (R + 0.5) * Math.sin(a)], 1.6, FIRE, [Math.cos(a), 0, Math.sin(a)], 5);
  }
  // the stencilled number, big, straight on its front: on a dark patch, pale paint
  const zf = z + R + 0.03;
  p.slab(SOOT, x - 0.62, x + 0.62, b0 + 1.0, b0 + 3.6, zf - 0.2, zf, thin);
  digit(p, num, x, b0 + 2.3, zf, 2.0, { c: '#cfcdc4', r: 0.8, m: 0, w: 0.9 });
  // three pipes up its sides from boxes on the floor, held by brackets, bending into its cap
  for (const a of [PI / 2 + 1.75, PI / 2 - 1.75, -PI / 2]) {
    const px = x + (R + 0.24) * Math.cos(a), pz = z + (R + 0.24) * Math.sin(a), top = b1 + 0.25;
    p.slab(SOOT, px - 0.22, px + 0.22, 0, 0.5, pz - 0.22, pz + 0.22, o9);
    p.cyl('gun', 0.11, top - 0.5, [px, (top + 0.5) / 2, pz], null, 12);
    for (let y = 1.6; y < top; y += 1.6) p.box('black', [0.3, 0.07, 0.3], [px, y, pz], [0, Math.atan2(Math.cos(a), Math.sin(a)), 0], thin);
    const g = cylinder(0.11, 0.42, [0, 0, 0], 12); put(g, [x + (R + 0.04) * Math.cos(a), top, z + (R + 0.04) * Math.sin(a)], [0, -a, PI / 2]); p.add('solid', g, 'gun');
  }
  // two flues from the cap up to the roof
  for (const s of [-1, 1]) { p.cyl(STEEL, 0.26, 11 - (b1 + 0.7), [x + s * 0.45, (11 + b1 + 0.7) / 2, z], null, 16); p.cyl(SOOT, 0.32, 0.12, [x + s * 0.45, b1 + 0.9, z], null, 16); }
}

// ── a ladle on its cart, under a spout, and the pour into it ──────────────────────────────────────────────────────
function ladle(p, x, z) {
  const r = 0.66, yb = 0.32, top = FORGE.ladleTop;
  p.slab('yellow', x - r - 0.18, x + r + 0.18, 0.12, yb, z - r * 0.85, z + r * 0.85, o9);
  p.slab('black', x - r - 0.2, x + r + 0.2, 0.1, 0.14, z - r * 0.87, z + r * 0.87, thin);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl('black', 0.12, 0.1, [x + sx * 0.3, 0.12, z + sz * r * 0.6], [0, 0, PI / 2], 12);
  p.lathe(SOOT, [[0.001, yb], [r * 0.78, yb], [r, top - 0.06], [r + 0.07, top - 0.04], [r + 0.07, top + 0.04], [r - 0.07, top + 0.04], [r - 0.07, top - 0.12], [0.001, top - 0.12]], 32, [x, 0, z]);
  for (const sx of [-1, 1]) { p.cyl('gun', 0.09, 0.2, [x + sx * (r + 0.08), top - 0.3, z], [0, 0, PI / 2], 12); p.slab('yellow', x + sx * (r + 0.15) - 0.04, x + sx * (r + 0.15) + 0.04, yb, top - 0.22, z - 0.06, z + 0.06, thin); }
  p.add('melt', cylinder(r - 0.08, 0.03, [x, top - 0.1, z], 32), HOT);
  p.add('melt', cylinder(0.3, 0.012, [x, top - 0.07, z], 20), WHITE_HOT);
  // the pour: a glowing column from the spout down to the surface, a little wider where it lands
  const y1 = FORGE.spout - 0.16, y0 = top - 0.08;
  p.add('melt', cylinder(0.075, y1 - y0, [x, (y0 + y1) / 2, z], 12), WHITE_HOT);
  p.add('melt', cylinder(0.16, 0.06, [x, y0 + 0.03, z], 16), WHITE_HOT);
  // its light: a strong pool round the ladle, the tower's underside and its sides lit from below, two beams of haze
  p.light([x, top + 0.5, z + 0.5], 16, FIRE, null, 13);
  p.light([x, 2.0, z], 7, FIRE, [0, 1, 0], 9);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; p.light([x + 0.9 * Math.cos(a), 1.3, z + 0.9 * Math.sin(a)], 5, FIRE, [0.5 * Math.cos(a), 0.85, 0.5 * Math.sin(a)], 9); }
  haze(p, [x, y1, z], [0, -1, 0], { r: 0.1, spread: 0.26, length: y1 - y0, strength: 1 });
  haze(p, [x, top, z], [0, 1, 0], { r: 0.5, spread: 0.32, length: 3.6, strength: 0.55 });
  // the rails it runs on, north to the casting line; the hot-surfaces plate before it
  for (const sx of [-1, 1]) p.slab('black', x + sx * 0.3 - 0.04, x + sx * 0.3 + 0.04, 0, 0.03, z - 2.9, z + 0.9, thin);
  p.slab('yellow', x - 0.8, x + 0.8, 0, 0.025, z + 1.3, z + 1.9, thin);
  floorDecal(p, 'hazard', 1.5, 0.5, x, z + 1.6, 0, '#d9b23a', 0.028);
  placed(p, (q) => { q.slab('black', -0.03, 0.03, 0, 1.15, -0.03, 0.03, thin); warning(q, 0, 1.25, 0.03, 0.42); }, [x + 0.95, 0, z + 1.6], 0);
}

// ── the catwalk at the pour's height, its stair, its rails ────────────────────────────────────────────────────────
function catwalk(p) {
  const { x: [x0, x1], z: [z0, z1], y } = FORGE.walk;
  floorQuad(p, 'grating', x0, x1, z0, z1, y);
  p.slab(SOOT, x0, x1, y - 0.18, y - 0.005, z0, z1, o9);
  for (const z of [z0, z1]) { p.slab('black', x0, x1, y, y + 0.1, z - 0.02, z + 0.02, thin); floorDecal(p, 'hazard', x1 - x0, 0.1, (x0 + x1) / 2, z + (z === z0 ? 0.06 : -0.06), 0, '#d9b23a', y + 0.006); }
  for (let x = x0 + 0.3; x < x1; x += 2.4) for (const z of [z0 + 0.1, z1 - 0.1]) p.slab(SOOT, x - 0.07, x + 0.07, 0, y - 0.18, z - 0.07, z + 0.07, o9);
  // rails: both long sides and the east end (the stair takes the west end)
  const post = (x, z) => p.cyl('yellow', 0.035, 1.07, [x, y + 0.535, z], null, 8);
  for (const z of [z0, z1]) { for (let x = x0 + 1.1; x <= x1 + 0.01; x += 1.5) post(x, z); for (const h of [0.55, 1.05]) bandedRail(p, [x0 + 1.1, y + h, z], [x1, y + h, z]); }
  post(x1, (z0 + z1) / 2); for (const h of [0.55, 1.05]) bandedRail(p, [x1, y + h, z0], [x1, y + h, z1]);
  // the stair: down the hall's west wall toward the north, from the catwalk's west end
  const sx0 = x0, sx1 = x0 + 1.0, n = 10, run = 0.28;
  for (let i = 0; i < n; i++) {
    const top = y - (i + 1) * (y / n), za = z0 - i * run;
    floorQuad(p, 'grating', sx0 + 0.04, sx1 - 0.04, za - run, za, top);
    p.slab(SOOT, sx0 + 0.04, sx1 - 0.04, top - 0.05, top - 0.005, za - run, za, thin);
  }
  const len = Math.hypot(n * run, y), ang = Math.atan2(y, n * run);
  for (const x of [sx0 + 0.02, sx1 - 0.02]) p.box(SOOT, [0.05, 0.22, len], [x, y / 2, z0 - n * run / 2], [-ang, 0, 0], o9);
  for (const x of [sx1 + 0.02]) for (const h of [0.9]) bandedRail(p, [x, y + h, z0], [x, h, z0 - n * run]);
  p.cyl('yellow', 0.035, 0.95, [sx1 + 0.02, 0.475, z0 - n * run], null, 8);
}

export function forge(p) {
  FORGE.towers.forEach(([x, z], i) => { tower(p, x, z, String(i + 1)); ladle(p, x, z); });
  catwalk(p);
  // the console, east of the towers, its screens toward the lobby's side (the operator faces the pours past them)
  placed(p, (q) => thermalConsole(q, { shows: ['drive', 'systems'], seeds: [0.25, 0.75] }), [4.4, 0, -1.6], PI / 2);
}

export const FORGE_PIECES = {
  forge: { name: "The smelter's forge (two towers)", group: 'Smelter', at: 'point', variants: ['two towers'], foot: [11.6, 11, 11.6], build: forge },
};
