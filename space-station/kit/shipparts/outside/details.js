// OUTSIDE DETAILS for a hull, from the game's maker's pictures. Each faces +z: its origin is the point on the hull's
// face it is fixed to (a flat panel's face, at a grid point or between), so a ship turns it to face out of that panel.
//   navLight(p, { color, size })      a small housing with a lens: color 'red' (port: the ship's left, +x), 'green',
//                                     'white' (tail and top); size 1
//   floodlight(p, { w, h, warm })     a lamp in a dark bezel (his ships' headlights, yellow-white): w 0.42, h 0.16;
//                                     warm true (yellow-white) or false (white); lights the floor in front of it
//   lightStrip(p, { len })            a dark housing with a blue strip of light (along his hulls): len 1.0
//   antenna(p, { h })                 a dark mast standing up (+y) off a roof: a base, a stout mast, a whip, stacked
//                                     rings, a red light on top; h 1.0
//   sensorDish(p, { r })              a small dish on a short post off a roof (+y), turned up and forward; r 0.32
//   vent(p, { w, h })                 a grille: a dark frame and slats; w 0.6, h 0.3
//   greeble(p, { kind, w, h })        a raised panel of machinery: 'box' (a block with a cover and bolts), 'pipes' (two
//                                     pipes over a plate), 'panel' (an access panel with a handle); w 0.8, h 0.4
import * as THREE from 'three';
import { SHIP, GLOW_SHIP } from '../palette.js';
import { GLOW } from '../../materials.js';
import { Acc } from './facet.js';
import { box, latheZ, bar, putAcc as putInto } from './shapes.js';

export function navLight(p, o = {}) {
  const k = o.size ?? 1, col = GLOW[o.color || 'red'] || GLOW.red, acc = new Acc();
  box(acc, SHIP.trim, [-0.08 * k, 0.08 * k], [-0.06 * k, 0.06 * k], [0, 0.07 * k]);
  latheZ(acc, [[0, 0.11 * k], [0.04 * k, 0.1 * k], [0.05 * k, 0.07 * k], [0, 0.07 * k]], 10, () => ({ glow: col }), { flat: false });
  acc.flush(p);
  p.light([0, 0, 0.3 * k], 0.25, col.map((c) => Math.min(1.4, c / 4)), [0, 0, 1], 2);
  return p;
}
export function floodlight(p, o = {}) {
  const w = o.w ?? 0.42, h = o.h ?? 0.16, col = o.warm === false ? GLOW.white : GLOW_SHIP.warm, acc = new Acc();
  box(acc, SHIP.trim, [-w / 2 - 0.04, w / 2 + 0.04], [-h / 2 - 0.04, h / 2 + 0.04], [0, 0.05]);
  box(acc, SHIP.frame, [-w / 2, w / 2], [-h / 2, h / 2], [0.05, 0.058]);
  box(acc, col, [-w / 2 + 0.02, w / 2 - 0.02], [-h / 2 + 0.02, h / 2 - 0.02], [0.058, 0.064], 'glow');
  // (a hood over it)
  box(acc, SHIP.trim, [-w / 2 - 0.04, w / 2 + 0.04], [h / 2 + 0.01, h / 2 + 0.04], [0.05, 0.12]);
  acc.flush(p);
  p.light([0, -0.2, 0.8], 1.6, o.warm === false ? [1, 1, 1] : [1.3, 1.05, 0.7], [0, -0.35, 1], 6);
  return p;
}
export function lightStrip(p, o = {}) {
  const L = o.len ?? 1.0, acc = new Acc();
  box(acc, SHIP.trim, [-L / 2, L / 2], [-0.06, 0.06], [0, 0.035]);
  box(acc, GLOW_SHIP.strip, [-L / 2 + 0.04, L / 2 - 0.04], [-0.025, 0.025], [0.035, 0.04], 'glow');
  return acc.flush(p);
}
export function antenna(p, o = {}) {
  const h = o.h ?? 1.0, acc = new Acc();
  // a dark mast as his: a base block, a stout lower mast, a thin upper whip, stacked rings up it, a red light on top
  box(acc, SHIP.trim, [-0.1, 0.1], [0, 0.08], [-0.14, 0.14]);
  latheZ(acc, [[0, h * 0.35], [0.04, h * 0.35], [0.04, 0.08], [0, 0.08]], 8, () => SHIP.trim, { axis: 'y' });
  latheZ(acc, [[0, h], [0.016, h], [0.016, h * 0.35], [0, h * 0.35]], 6, () => SHIP.gun, { axis: 'y' });
  for (const f of [0.2, 0.3, 0.45, 0.6, 0.75]) { const y = h * f, r = f < 0.35 ? 0.07 : 0.045; latheZ(acc, [[0.01, y + 0.025], [r, y + 0.02], [r, y - 0.02], [0.01, y - 0.025]], 8, () => SHIP.frame, { axis: 'y' }); }
  latheZ(acc, [[0, h + 0.05], [0.025, h + 0.03], [0.025, h], [0, h]], 8, () => ({ glow: GLOW.red }), { axis: 'y', flat: false });
  return acc.flush(p);
}
export function sensorDish(p, o = {}) {
  const r = o.r ?? 0.32, acc = new Acc(), sub = new Acc();
  box(acc, SHIP.trim, [-0.12, 0.12], [0, 0.06], [-0.12, 0.12]);
  latheZ(acc, [[0, 0.32], [0.045, 0.32], [0.045, 0.06], [0, 0.06]], 8, () => SHIP.gun, { axis: 'y' });
  // the dish: a shallow bowl facing +z, a feed on struts in front of it; turned up 30 degrees and set on the post
  latheZ(sub, [[0, 0.02], [r * 0.5, 0.0], [r, -0.09 * r / 0.32], [r * 1.02, -0.06 * r / 0.32], [r * 0.5, 0.03], [0, 0.05]].map(([q, z]) => [q, z]), 16, (i) => (i < 2 ? SHIP.hull : SHIP.hull2), { flat: false });
  latheZ(sub, [[0, r * 0.75], [0.03, r * 0.73], [0.03, r * 0.6], [0, r * 0.6]], 6, () => SHIP.trim);
  for (const a of [0, 2.1, 4.2]) bar(sub, SHIP.gun, [Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, -0.054 * r / 0.32 + 0.025], [0, 0, r * 0.62], 0.015, 0.015);   // (from the bowl's face, not through it)
  const M = new THREE.Matrix4().makeRotationX(-0.52).setPosition(0, 0.36 + r * 0.5, 0);
  putInto(acc, sub, M);
  return acc.flush(p);
}
export function vent(p, o = {}) {
  const w = o.w ?? 0.6, h = o.h ?? 0.3, acc = new Acc();
  for (const [x0, x1, y0, y1] of [[-w / 2, w / 2, h / 2 - 0.035, h / 2], [-w / 2, w / 2, -h / 2, -h / 2 + 0.035], [-w / 2, -w / 2 + 0.035, -h / 2, h / 2], [w / 2 - 0.035, w / 2, -h / 2, h / 2]]) box(acc, SHIP.trim, [x0, x1], [y0, y1], [0, 0.04]);
  box(acc, SHIP.frame, [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.006]);
  const n = Math.max(3, Math.round(h / 0.05));
  for (let i = 0; i < n; i++) { const y = -h / 2 + 0.045 + (h - 0.09) * (i + 0.5) / n; box(acc, SHIP.gun, [-w / 2 + 0.035, w / 2 - 0.035], [y - 0.008, y + 0.008], [0.006, 0.03]); }
  return acc.flush(p);
}
export function greeble(p, o = {}) {
  const kind = o.kind || 'box', w = o.w ?? 0.8, h = o.h ?? 0.4, acc = new Acc(), T = SHIP.trim;
  box(acc, T, [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.03]);
  if (kind === 'box') {
    box(acc, SHIP.grey, [-w * 0.42, w * 0.1], [-h * 0.38, h * 0.38], [0.03, 0.13]);
    box(acc, SHIP.hull2, [w * 0.14, w * 0.44], [-h * 0.38, h * 0.1], [0.03, 0.09]);
    for (const [x, y] of [[-w * 0.38, h * 0.32], [w * 0.06, h * 0.32], [-w * 0.38, -h * 0.32], [w * 0.06, -h * 0.32]]) box(acc, SHIP.gun, [x - 0.012, x + 0.012], [y - 0.012, y + 0.012], [0.13, 0.14]);
    box(acc, GLOW.amber, [w * 0.22, w * 0.3], [h * 0.2, h * 0.28], [0.03, 0.04], 'glow');
  } else if (kind === 'pipes') {
    for (const y of [-h * 0.18, h * 0.18]) latheZ(acc, [[0, w / 2 - 0.03], [0.035, w / 2 - 0.03], [0.035, -w / 2 + 0.03], [0, -w / 2 + 0.03]], 8, () => SHIP.gun, { axis: 'x', at: [0, y, 0.08] });
    for (const x of [-w * 0.3, w * 0.3]) box(acc, T, [x - 0.03, x + 0.03], [-h * 0.3, h * 0.3], [0.03, 0.12]);
  } else {
    box(acc, SHIP.hull2, [-w * 0.44, w * 0.44], [-h * 0.42, h * 0.42], [0.03, 0.05]);
    box(acc, SHIP.frame, [-w * 0.1, w * 0.1], [h * 0.12, h * 0.2], [0.05, 0.08]);
    box(acc, SHIP.yellow, [-w * 0.44, -w * 0.3], [-h * 0.42, h * 0.42], [0.05, 0.055]);
  }
  return acc.flush(p);
}
