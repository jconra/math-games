// FURNITURE, in the station's look (off-white panels, charcoal frames, small glowing strips). All are 'free' pieces:
// placed by cell, turn and `off`, each standing on y = 0 and facing +z (its front, where someone sits or walks up).
// Things that stand against a wall have their back on z = 0.
//   quarters   bunk ('single', 'double'), cabinet ('tall', 'double'), desk ('screen'), chair ('desk', 'stool', 'bar',
//              'bench')
//   galley     counter ('serve', 'plain', 'end'), table ('round', 'long'), dispenser ('drinks')
//   captains   booth (one per crew: 'medic', 'mining', 'explore', 'security': a U of benches round a table, a screen
//              with the captain's card, the crew's colour), jobs (the jobs board: 'hang' from the ceiling, both faces,
//              or 'wall')
import * as THREE from 'three';
import { rrect, circle, line, put } from './geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SCREEN_RECT, CREWS } from './tex.js';
import { GLOW } from './materials.js';

const PI = Math.PI;
const FABRIC = { c: '#b8693a', r: 0.92, m: 0, w: 0.25 }, FABRIC2 = { c: '#8c4a28', r: 0.95, m: 0, w: 0.25 }, LINEN = { c: '#c9ccc9', r: 0.9, m: 0, w: 0.2 };
const CUSHION = { c: '#2d3036', r: 0.85, m: 0, w: 0.3 }, TOP = { c: '#c9cac6', r: 0.35, m: 0.05, w: 0.5 };
const FOOD = [{ c: '#d98a2b', r: 0.7 }, { c: '#7fa83a', r: 0.75 }, { c: '#e2c25a', r: 0.7 }, { c: '#b8452f', r: 0.7 }, { c: '#d9d2b8', r: 0.8 }];
const CREW_GLOW = { medic: 'red', mining: 'orange', explore: 'green', security: 'blue' };

// ── quarters ──────────────────────────────────────────────────────────────────────────────────────────────────────
// one bed: a base with two drawers, a mattress, a blanket and a pillow, from x = -1 to 1, its back on z = 0, at y
function bed(p, y, drawers = true) {
  p.slab('white', -1, 1, y, y + 0.36, 0.02, 0.95, { r: 0.016, cell: 0.6 });
  p.slab('black', -0.98, 0.98, y, y + 0.06, 0.04, 0.9, { r: 0.01, cell: 0.8 });
  if (drawers) for (const x of [-0.5, 0.5]) { p.slab('white2', x - 0.46, x + 0.46, y + 0.09, y + 0.33, 0.94, 0.97, { r: 0.008 }); p.slab('black', x - 0.12, x + 0.12, y + 0.26, y + 0.28, 0.97, 0.985, { r: 0.004 }); }
  p.slab(LINEN, -0.97, 0.97, y + 0.36, y + 0.53, 0.05, 0.92, { r: 0.05, seg: 2, cell: 0.5 });
  p.slab(FABRIC, -0.42, 0.98, y + 0.5, y + 0.565, 0.03, 0.94, { r: 0.03, seg: 2, cell: 0.5 });
  p.slab(FABRIC2, -0.46, -0.3, y + 0.5, y + 0.58, 0.03, 0.94, { r: 0.035, seg: 2, cell: 0.5 });   // (the blanket's folded edge)
  p.slab(LINEN, -0.95, -0.55, y + 0.52, y + 0.64, 0.12, 0.6, { r: 0.05, seg: 2 });
}
export function bunk(p, v) {
  if (v === 'double') {
    bed(p, 0); bed(p, 1.32, false);
    // end panels to 2.25 m, a safety rail along the top bunk, a ladder at the foot
    for (const s of [-1, 1]) { p.slab('white', s < 0 ? -1.06 : 1, s < 0 ? -1 : 1.06, 0, 2.25, 0.0, 1.0, { r: 0.012, cell: 0.6 }); p.slab('black', s < 0 ? -1.07 : 1, s < 0 ? -1 : 1.07, 2.2, 2.25, 0.0, 1.0, { r: 0.01 }); }
    p.slab('black', -0.98, 0.5, 1.95, 2.0, 0.92, 0.97, { r: 0.016, cell: 0.8 }); for (const x of [-0.9, 0.42]) p.slab('black', x - 0.02, x + 0.02, 1.68, 1.96, 0.93, 0.96, { r: 0.008 });
    for (const x of [0.62, 0.94]) p.slab('black', x - 0.02, x + 0.02, 0.05, 2.02, 0.97, 1.01, { r: 0.01 });
    for (let y = 0.3; y < 2.0; y += 0.3) p.slab('rail', 0.62, 0.94, y - 0.015, y + 0.015, 0.975, 1.005, { r: 0.008 });
    for (const y of [1.1, 2.1]) { p.slab('black', -0.95, -0.82, y, y + 0.06, 0.02, 0.06, { r: 0.008 }); p.glowSlab('soft', -0.94, -0.83, y + 0.005, y + 0.015, 0.06, 0.064); p.light([-0.88, y - 0.1, 0.3], 0.35, [1, 0.92, 0.8], [0, -0.6, 0.8], 2.2); }
    return;
  }
  bed(p, 0);
  // a headboard panel on the wall with a shelf and a reading light, and an end panel at the head
  p.slab('white', -1, 1, 0.36, 1.25, 0.0, 0.05, { r: 0.01, cell: 0.6 });
  p.slab('black', -1, 1, 1.25, 1.3, 0.0, 0.25, { r: 0.012, cell: 0.8 }); p.slab('white2', -1, 1, 1.3, 1.33, 0.0, 0.24, { r: 0.008, cell: 0.8 });
  p.slab('white', -1.06, -1, 0, 1.0, 0.0, 0.96, { r: 0.012, cell: 0.6 });
  p.slab('black', -0.86, -0.66, 1.08, 1.16, 0.05, 0.1, { r: 0.01 }); p.glowSlab('soft', -0.85, -0.67, 1.085, 1.095, 0.1, 0.104);
  p.light([-0.76, 1.0, 0.35], 0.4, [1, 0.92, 0.8], [0, -0.6, 0.8], 2.2);
  for (const [x, w, h, s] of [[0.25, 0.09, 0.2, 'orange'], [0.36, 0.08, 0.17, 'grey'], [0.46, 0.1, 0.22, 'black']]) p.slab(s, x - w / 2, x + w / 2, 1.33, 1.33 + h, 0.05, 0.2, { r: 0.008 });
}
export function cabinet(p, v) {
  const w = v === 'double' ? 0.6 : 0.3, d = 0.55, h = 2.05;
  p.slab('white', -w, w, 0.1, h, 0.0, d, { r: 0.014, cell: 0.6 });
  p.slab('black', -w + 0.02, w - 0.02, 0, 0.1, 0.02, d - 0.04, { r: 0.01 });
  const doors = v === 'double' ? [-w / 2, w / 2] : [0];
  for (const x of doors) {
    const hw = (v === 'double' ? w / 2 : w) - 0.02;
    p.slab('white2', x - hw, x + hw, 0.14, h - 0.04, d, d + 0.025, { r: 0.008, cell: 0.6 });
    p.slab('band', x - hw + 0.03, x + hw - 0.03, 1.22, 1.5, d + 0.025, d + 0.03, { r: 0.004 });
    for (let k = 0; k < 5; k++) p.slab('dark', x - hw + 0.06, x + hw - 0.06, 1.75 + k * 0.045, 1.765 + k * 0.045, d + 0.025, d + 0.03, { r: 0 });
    p.slab('black', x + (x <= 0 && doors.length > 1 ? hw - 0.07 : -hw + 0.04), x + (x <= 0 && doors.length > 1 ? hw - 0.04 : -hw + 0.07), 0.95, 1.18, d + 0.025, d + 0.05, { r: 0.01 });
    p.decal('label:CREW', 0.18, 0.045, [x, 1.62, d + 0.0262], null, '#2a2c30');
  }
}
export function desk(p) {
  // a top from x = -0.7 to 0.7, its back on the wall; a drawer unit; a screen on an arm from the wall; a keyboard
  p.slab(TOP, -0.7, 0.7, 0.72, 0.76, 0.0, 0.62, { r: 0.012, cell: 0.6 });
  p.slab('black', -0.7, 0.7, 0.7, 0.72, 0.0, 0.62, { r: 0.006, cell: 0.8 });
  p.slab('white', 0.25, 0.68, 0.06, 0.7, 0.02, 0.58, { r: 0.012 });
  for (const y of [0.22, 0.46]) { p.slab('white2', 0.27, 0.66, y - 0.1, y + 0.1, 0.58, 0.6, { r: 0.006 }); p.slab('black', 0.4, 0.53, y + 0.04, y + 0.06, 0.6, 0.61, { r: 0.004 }); }
  p.slab('black', -0.68, -0.62, 0, 0.7, 0.02, 0.56, { r: 0.01 }); p.slab('white', -0.68, 0.25, 0.1, 0.62, 0.0, 0.03, { r: 0.008, cell: 0.6 });
  p.slab('black', -0.06, 0.06, 1.0, 1.08, 0.0, 0.12, { r: 0.01 });
  p.slab('white2', -0.34, 0.34, 0.92, 1.34, 0.1, 0.16, { r: 0.016 }); p.slab('black', -0.31, 0.31, 0.95, 1.31, 0.155, 0.165, { r: 0.006 });
  p.screen(SCREEN_RECT.terminal, 0.58, 0.3, [0, 1.13, 0.166], null, 1.1);
  p.slab('dark', -0.24, 0.16, 0.76, 0.775, 0.3, 0.45, { r: 0.006 }); p.slab('grey', 0.24, 0.32, 0.76, 0.775, 0.34, 0.44, { r: 0.008 });
  p.light([0, 1.1, 0.45], 0.4, [0.35, 0.65, 1], [0, -0.3, 1], 2.5);
}
export function chair(p, v) {
  if (v === 'bench') {
    p.slab(CUSHION, -0.85, 0.85, 0.4, 0.47, -0.2, 0.2, { r: 0.03, seg: 2, cell: 0.6 });
    p.slab('white', -0.86, 0.86, 0.34, 0.4, -0.21, 0.21, { r: 0.012, cell: 0.6 });
    for (const x of [-0.7, 0.7]) { p.slab('black', x - 0.04, x + 0.04, 0, 0.34, -0.15, 0.15, { r: 0.012 }); }
    return;
  }
  if (v === 'stool' || v === 'bar') {
    const h = v === 'bar' ? 0.76 : 0.46;
    p.lathe('black', [[0.001, 0], [0.2, 0], [0.21, 0.02], [0.2, 0.04], [0.04, 0.05], [0.035, h - 0.04], [0.001, h - 0.04]], 20);
    p.lathe('white2', [[0.001, h - 0.05], [0.17, h - 0.05], [0.19, h - 0.02], [0.001, h - 0.02]], 22);
    p.lathe(CUSHION, [[0.001, h - 0.025], [0.175, h - 0.025], [0.18, h + 0.02], [0.14, h + 0.045], [0.001, h + 0.05]], 22);
    if (v === 'bar') { const ring = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * PI * 2; ring.push({ p: new THREE.Vector3(Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15), x: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), y: new THREE.Vector3(0, 1, 0) }); } p.sweep('rail', circle(0.012, 8), ring, { closed: true }); for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; p.box('black', [0.13, 0.016, 0.016], [Math.cos(a) * 0.09, 0.3, Math.sin(a) * 0.09], [0, -a, 0], { r: 0 }); } }
    return;
  }
  // a desk chair: five feet, a column, a seat, a back (its front faces +z)
  for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + 0.3; p.box('black', [0.3, 0.04, 0.05], [Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15], [0, -a, 0], { r: 0.012 }); p.cyl('rubber', 0.025, 0.04, [Math.cos(a) * 0.29, 0.025, Math.sin(a) * 0.29], [0, 0, PI / 2], 10); }
  p.cyl('chrome', 0.025, 0.36, [0, 0.24, 0], null, 12); p.cyl('black', 0.04, 0.12, [0, 0.12, 0], null, 12);
  p.slab('black', -0.22, 0.22, 0.42, 0.46, -0.2, 0.22, { r: 0.012 });
  p.slab(CUSHION, -0.23, 0.23, 0.46, 0.53, -0.21, 0.23, { r: 0.03, seg: 2 });
  p.box('black', [0.06, 0.42, 0.04], [0, 0.66, -0.23], [-0.12, 0, 0], { r: 0.012 });
  p.box(CUSHION, [0.42, 0.42, 0.06], [0, 0.86, -0.26], [-0.14, 0, 0], { r: 0.03, seg: 2 });
}

// ── the galley ────────────────────────────────────────────────────────────────────────────────────────────────────
// a serving counter, 2 m along x, 0.8 m deep: customers on +z, the cook on -z
export function counter(p, v) {
  if (v === 'end') {
    // a rounded end for a run of counter: a quarter drum from x = 0 round to z = 0 (it caps a counter ending at x = 0)
    p.lathe('white', [[0.001, 0.12], [0.4, 0.12], [0.4, 0.9], [0.001, 0.9]], 24, [0, 0, 0]);
    p.lathe('black', [[0.001, 0], [0.37, 0], [0.37, 0.12], [0.001, 0.12]], 24);
    p.lathe(TOP, [[0.001, 0.9], [0.44, 0.9], [0.45, 0.92], [0.44, 0.94], [0.001, 0.94]], 28);
    return;
  }
  p.slab('white', -1, 1, 0.12, 0.9, -0.4, 0.36, { r: 0.012, cell: 0.6 });
  p.slab('black', -0.98, 0.98, 0, 0.12, -0.36, 0.3, { r: 0.01, cell: 0.8 });
  p.slab(TOP, -1, 1, 0.9, 0.94, -0.42, 0.44, { r: 0.012, cell: 0.6 });
  p.slab('band', -0.98, 0.98, 0.5, 0.62, 0.36, 0.37, { r: 0.004, cell: 0.8 });
  p.slab('black', -1, 1, 0.86, 0.9, 0.38, 0.42, { r: 0.008, cell: 0.8 }); p.glowSlab('soft', -0.97, 0.97, 0.855, 0.86, 0.39, 0.41);
  p.light([-0.5, 0.75, 0.6], 0.3, [0.92, 0.96, 1], [0, -0.5, 0.86], 2); p.light([0.5, 0.75, 0.6], 0.3, [0.92, 0.96, 1], [0, -0.5, 0.86], 2);
  if (v === 'plain') { for (const x of [-0.5, 0.5]) p.slab('white2', x - 0.46, x + 0.46, 0.16, 0.86, 0.36, 0.375, { r: 0.006 }); return; }
  // a tray rail along the customers' side, food wells in the top with dishes in them, a heat-lamp canopy over them
  p.slab('rail', -1, 1, 0.8, 0.83, 0.5, 0.58, { r: 0.012, cell: 0.8 }); for (const x of [-0.8, 0, 0.8]) p.slab('rail', x - 0.02, x + 0.02, 0.76, 0.8, 0.42, 0.56, { r: 0.006 });
  for (let k = 0; k < 4; k++) {
    const x = -0.72 + k * 0.48;
    p.slab('chrome', x - 0.21, x + 0.21, 0.915, 0.945, -0.2, 0.2, { r: 0.008 });
    p.slab(FOOD[k], x - 0.18, x + 0.18, 0.93, 0.965, -0.17, 0.17, { r: 0.03, seg: 2 });
  }
  for (const x of [-0.95, 0.95]) p.slab('black', x - 0.025, x + 0.025, 0.94, 1.5, -0.04, 0.0, { r: 0.008 });
  p.slab('black', -0.98, 0.98, 1.5, 1.56, -0.26, 0.2, { r: 0.016, cell: 0.8 });
  p.glowSlab('amber', -0.92, 0.92, 1.495, 1.5, -0.18, 0.12);
  for (let k = 0; k < 4; k++) p.light([-0.72 + k * 0.48, 1.35, 0], 0.5, [1, 0.7, 0.4], [0, -1, 0], 2);
}
export function table(p, v) {
  if (v === 'set') {
    // a round table laid: an orange tray with a bowl, two cups, a plate
    table(p, 'round');
    p.slab('orange', -0.2, 0.12, 0.745, 0.765, -0.05, 0.2, { r: 0.008 });
    p.lathe('white2', [[0.001, 0.765], [0.06, 0.765], [0.085, 0.8], [0.077, 0.802], [0.05, 0.775], [0.001, 0.775]], 18, [-0.04, 0, 0.08]);
    p.lathe(FOOD[0], [[0.001, 0.78], [0.07, 0.785], [0.001, 0.795]], 14, [-0.04, 0, 0.08]);
    for (const [x, z, s] of [[0.22, -0.18, 'white2'], [-0.28, -0.2, 'orange']]) { p.lathe(s, [[0.001, 0.745], [0.03, 0.745], [0.036, 0.84], [0.032, 0.84], [0.026, 0.755], [0.001, 0.755]], 14, [x, 0, z]); p.cyl('dark', 0.03, 0.006, [x, 0.83, z], null, 12); }
    p.lathe('white2', [[0.001, 0.745], [0.1, 0.745], [0.12, 0.758], [0.001, 0.752]], 20, [0.25, 0, 0.18]);
    return;
  }
  if (v === 'long') {
    p.slab(TOP, -1, 1, 0.72, 0.76, -0.45, 0.45, { r: 0.016, cell: 0.6 });
    p.slab('black', -1, 1, 0.7, 0.72, -0.45, 0.45, { r: 0.006, cell: 0.8 });
    for (const x of [-0.7, 0.7]) { p.slab('black', x - 0.04, x + 0.04, 0.06, 0.7, -0.04, 0.04, { r: 0.012 }); p.slab('black', x - 0.05, x + 0.05, 0, 0.06, -0.36, 0.36, { r: 0.012 }); }
    p.slab('black', -0.7, 0.7, 0.6, 0.66, -0.03, 0.03, { r: 0.01, cell: 0.8 });
    return;
  }
  p.lathe('black', [[0.001, 0], [0.3, 0], [0.31, 0.02], [0.3, 0.04], [0.05, 0.06], [0.045, 0.68], [0.001, 0.68]], 24);
  p.lathe('black', [[0.001, 0.68], [0.5, 0.68], [0.5, 0.71], [0.001, 0.71]], 32);
  p.lathe(TOP, [[0.001, 0.71], [0.5, 0.71], [0.515, 0.725], [0.505, 0.745], [0.001, 0.745]], 32);
}
export function dispenser(p) {
  // a tall unit against a wall: a lit drinks panel, three nozzles in a recess over a drip grille, a stack of cups
  p.slab('white', -0.45, 0.45, 0.1, 1.95, 0.0, 0.55, { r: 0.016, cell: 0.6 });
  p.slab('black', -0.43, 0.43, 0, 0.1, 0.02, 0.5, { r: 0.01 });
  p.slab('black', -0.4, 0.4, 1.3, 1.82, 0.54, 0.57, { r: 0.012 });
  p.screen(SCREEN_RECT.drinks, 0.74, 0.185, [0, 1.62, 0.572], null, 1.2);
  p.slab('dark', -0.36, 0.36, 0.7, 1.22, 0.4, 0.552, { r: 0.01 });
  for (let k = 0; k < 3; k++) { const x = -0.22 + k * 0.22; p.cyl('chrome', 0.03, 0.1, [x, 1.14, 0.48], null, 12); p.cyl('black', 0.018, 0.04, [x, 1.07, 0.48], null, 10); p.glowSlab(['blue', 'orange', 'amber'][k], x - 0.05, x + 0.05, 1.2, 1.21, 0.548, 0.552); }
  p.slab('chrome', -0.34, 0.34, 0.72, 0.76, 0.4, 0.56, { r: 0.008 }); for (let k = 0; k < 8; k++) p.slab('dark', -0.32 + k * 0.085, -0.3 + k * 0.085, 0.755, 0.762, 0.42, 0.54, { r: 0 });
  for (let k = 0; k < 5; k++) p.lathe('white2', [[0.001, 0.76 + k * 0.025], [0.045, 0.76 + k * 0.025], [0.05, 0.79 + k * 0.025], [0.001, 0.79 + k * 0.025]], 14, [0.32, 0.02, 0.47]);
  p.slab('band', -0.43, 0.43, 0.4, 0.55, 0.55, 0.56, { r: 0.004 });
  p.light([0, 1.55, 0.8], 0.45, [0.4, 0.7, 1], [0, 0, 1], 2.5); p.light([0, 0.95, 0.65], 0.3, [0.9, 0.8, 0.6], [0, 0, 1], 1.5);
}

// ── the captains ──────────────────────────────────────────────────────────────────────────────────────────────────
// a booth in one 2 x 2 m cell (its back on z = -1): a U of benches round a table, a partition behind with the
// captain's card on a screen and a strip in the crew's colour
export function booth(p, v) {
  const crew = CREWS[v] ? v : 'medic', glow = CREW_GLOW[crew];
  // the partition: a panel 1.7 m tall across the back, a cap, the screen and the colour strip
  p.slab('white', -0.98, 0.98, 0, 1.7, -1, -0.9, { r: 0.016, cell: 0.6 }); p.slab('black', -1, 1, 1.7, 1.76, -1.01, -0.88, { r: 0.012, cell: 0.8 });
  p.slab('black', -0.98, 0.98, 0, 0.1, -0.9, -0.88, { r: 0.008 });
  p.slab('black', -0.4, 0.4, 1.06, 1.62, -0.9, -0.86, { r: 0.012 }); p.screen(SCREEN_RECT['crew:' + crew], 0.72, 0.48, [0, 1.34, -0.858], null, 1.15);
  p.slab('dark', -0.96, 0.96, 1.62, 1.66, -0.9, -0.885, { r: 0.004 }); p.glowSlab(glow, -0.94, 0.94, 1.63, 1.65, -0.885, -0.881);
  p.light([0, 1.3, -0.5], 0.5, GLOW[glow].map((c) => c / 7), [0, -0.2, 1], 3);
  // the benches: along the back and up each side, low backs on the sides
  const bench = (x0, x1, z0, z1) => { p.slab('white', x0, x1, 0.1, 0.4, z0, z1, { r: 0.012, cell: 0.6 }); p.slab(CUSHION, x0 + 0.02, x1 - 0.02, 0.4, 0.47, z0 + 0.02, z1 - 0.02, { r: 0.03, seg: 2, cell: 0.6 }); p.slab('black', x0 + 0.02, x1 - 0.02, 0, 0.1, z0 + 0.03, z1 - 0.03, { r: 0.01 }); };
  bench(-0.96, 0.96, -0.9, -0.45); p.slab(CUSHION, -0.94, 0.94, 0.47, 0.95, -0.9, -0.8, { r: 0.04, seg: 2, cell: 0.6 });
  for (const s of [-1, 1]) { bench(s < 0 ? -0.96 : 0.51, s < 0 ? -0.51 : 0.96, -0.45, 0.6); p.slab('white', s < 0 ? -0.98 : 0.9, s < 0 ? -0.9 : 0.98, 0.1, 0.9, -0.9, 0.6, { r: 0.012, cell: 0.6 }); p.slab('black', s < 0 ? -0.99 : 0.89, s < 0 ? -0.89 : 0.99, 0.9, 0.94, -0.9, 0.6, { r: 0.012, cell: 0.8 }); }
  // the table, on a pedestal
  p.slab(TOP, -0.4, 0.4, 0.72, 0.76, -0.4, 0.42, { r: 0.04, seg: 2, cell: 0.6 }); p.slab('black', -0.4, 0.4, 0.7, 0.72, -0.4, 0.42, { r: 0.03, cell: 0.8 });
  p.cyl('black', 0.05, 0.7, [0, 0.35, 0], null, 12); p.cyl('black', 0.22, 0.03, [0, 0.015, 0], null, 18);
  p.slab('dark', -0.1, 0.1, 0.76, 0.77, -0.1, 0.06, { r: 0.004 }); p.glowSlab(glow, -0.08, 0.08, 0.77, 0.773, -0.08, 0.04);
}
// a planter: a pale trough on a dark plinth, full of leafy green ('long' 1.6 m along x, 'tall' a round pot with a
// small tree)
const LEAF = { c: '#3f6236', r: 0.85, m: 0, w: 0.5 }, LEAF2 = { c: '#2c4a2a', r: 0.9, m: 0, w: 0.5 }, LEAF3 = { c: '#56703f', r: 0.85, m: 0, w: 0.5 }, SOIL = { c: '#2b2420', r: 0.95, m: 0, w: 0.2 };
export function planter(p, v) {
  const blob = (x, y, z, r, s, sy = 1) => { const g = new THREE.IcosahedronGeometry(r, 1); put(g, [x, y, z], [0, x * 7, 0], [1.3, sy, 1]); const m = g.index ? g : mergeV(g); p.add('solid', m, s); };
  if (v === 'tall') {
    p.lathe('white2', [[0.001, 0.08], [0.3, 0.08], [0.34, 0.6], [0.3, 0.62], [0.001, 0.62]], 24);
    p.lathe('black', [[0.001, 0], [0.26, 0], [0.26, 0.08], [0.001, 0.08]], 20); p.cyl(SOIL, 0.29, 0.02, [0, 0.6, 0], null, 20);
    p.cyl('dark', 0.035, 1.0, [0, 1.1, 0], null, 8);
    for (const [x, y, z, r, s] of [[0, 1.7, 0, 0.42, LEAF], [0.25, 1.5, 0.1, 0.3, LEAF2], [-0.22, 1.55, -0.12, 0.32, LEAF2], [0.05, 1.95, -0.1, 0.3, LEAF]]) blob(x, y, z, r, s);
    return;
  }
  p.slab('black', -0.8, 0.8, 0, 0.08, -0.24, 0.24, { r: 0.01 });
  p.slab('white2', -0.82, 0.82, 0.08, 0.5, -0.26, 0.26, { r: 0.03 }); p.slab(SOIL, -0.77, 0.77, 0.48, 0.505, -0.21, 0.21, { r: 0 });
  p.slab('band', -0.82, 0.82, 0.3, 0.34, 0.255, 0.265, { r: 0.004 });
  // (low leafy clumps of three greens, squashed and scattered, under a grow light on two thin posts)
  for (let k = 0; k < 16; k++) { const x = -0.7 + k * 0.093, sz = 0.07 + ((k * 7) % 5) * 0.012; blob(x, 0.54 + ((k * 3) % 4) * 0.02, ((k * 5) % 7 - 3) * 0.04, sz, [LEAF, LEAF2, LEAF3][k % 3], 0.75); }
  for (const x of [-0.78, 0.78]) p.slab('rail', x - 0.015, x + 0.015, 0.5, 1.15, -0.015, 0.015, { r: 0.005 });
  p.slab('black', -0.8, 0.8, 1.15, 1.19, -0.05, 0.05, { r: 0.01 }); p.glowSlab('soft', -0.76, 0.76, 1.145, 1.15, -0.03, 0.03);
  p.light([0, 1.0, 0], 0.5, [1, 0.95, 0.9], [0, -1, 0], 2);
}
// (an icosphere comes unindexed: merge its corners, give it the blank uv every part carries)
const mergeV = (g) => { g.deleteAttribute('uv'); const m = mergeVertices(g, 1e-5); m.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(m.attributes.position.count * 2), 2)); return m; };
// a lit sign: white capitals on a deep blue panel in a charcoal box ('<NAME>' 1.2 m wide, '<NAME> big' 2.4 m), its
// middle at y = 0, its back on z = 0 (a wall-kit item: it hangs on a wall's face)
export function sign(p, v) {
  const big = v.endsWith(' big'), name = v.replace(/ big$/, ''), w = big ? 2.4 : 1.2, h = w / 4;
  p.slab('black', -w / 2 - 0.05, w / 2 + 0.05, -h / 2 - 0.05, h / 2 + 0.05, 0, 0.08, { r: 0.02 });
  p.screen(SCREEN_RECT['sign:' + name], w, h, [0, 0, 0.082], null, 1.3);
  p.light([0, 0, 0.5], big ? 0.8 : 0.4, [0.5, 0.75, 1], [0, 0, 1], 3);
}
// the jobs board: a big screen of captains hiring. 'hang': both faces, hung by two rods from the ceiling (its middle
// at y = 0: the layout lifts it); 'wall': one face, its back on z = 0; 'menu': the galley's menu board, for a wall
export function jobs(p, v) {
  if (v === 'menu') {
    p.slab('black', -0.9, 0.9, -0.42, 0.42, 0, 0.1, { r: 0.02, cell: 0.8 });
    p.screen(SCREEN_RECT.menu, 1.68, 0.7, [0, 0, 0.102], null, 1.1);
    p.glowSlab('amber', -0.86, 0.86, -0.43, -0.425, 0.06, 0.09);
    p.light([0, -0.1, 0.6], 0.8, [1, 0.75, 0.45], [0, -0.3, 1], 4);
    return;
  }
  const W = 4.2, Hh = 1.68, o = { r: 0.03, cell: 0.8 };
  const z0 = v === 'wall' ? 0 : -0.12, z1 = v === 'wall' ? 0.2 : 0.12;
  p.slab('black', -W / 2 - 0.12, W / 2 + 0.12, -Hh / 2 - 0.12, Hh / 2 + 0.12, z0, z1, o);
  p.slab('dark', -W / 2 - 0.13, W / 2 + 0.13, -Hh / 2 - 0.2, -Hh / 2 - 0.12, z0 + 0.02, z1 - 0.02, { r: 0.02, cell: 0.8 });
  for (const s of v === 'wall' ? [1] : [1, -1]) {
    const q = new (p.constructor)();
    q.screen(SCREEN_RECT.jobs, W, Hh, [0, 0, 0.122], null, 1.15);
    q.glowSlab('blue', -W / 2 - 0.1, W / 2 + 0.1, -Hh / 2 - 0.16, -Hh / 2 - 0.15, 0.1, 0.105);
    for (const x of [-1.4, 0, 1.4]) q.light([x, 0, 0.8], 1.4, [0.35, 0.65, 1], [0, -0.2, 1], 7);
    for (const part of q.parts) { if (v === 'wall') put(part.geo, [0, 0, 0.08]); else if (s < 0) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(v === 'wall' ? { ...L, at: [L.at[0], L.at[1], L.at[2] + 0.08] } : s < 0 ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  if (v !== 'wall') for (const x of [-1.6, 1.6]) { p.cyl('black', 0.02, 2.6, [x, Hh / 2 + 0.12 + 1.3, 0], null, 8); p.cyl('black', 0.05, 0.08, [x, Hh / 2 + 0.16, 0], null, 12); }
}
