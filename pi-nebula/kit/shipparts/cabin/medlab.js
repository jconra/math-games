// THE MEDIC'S PHARMACY AND LAB: one open room with the crew hall (the game's maker, 2026-11-10: "red is pharmacy and lab
// area, no door/wall needed, just one big room"; "The lab area can probably have an island counter with stuff on it.
// Microscope, centerfuge, that kind of stuff"; his pick, plan 2: "the bench along the wall"). Shallow built-ins with their
// free corners cut at 45 degrees; the island's four corners cut too.
// Frames (kit/shipparts/cabin/ship.js): WALL fittings stand on a wall line (x along it, z out, facing +z, the deck y 0);
// the island stands FREE, centred, its long side along z.
//   drugsCabinet(p, o)   the drugs: one tall locked cabinet, shallow, two glass doors on shelves of boxes, a keypad lock
//                        with its light, PHARMACY over it, lit inside. o.w, o.h, o.d
//   suppliesRack(p, o)   by the med bay's door: two folding stretchers hung flat, shelves of folded blankets, a bin of
//                        splints and neck collars, SUPPLIES on its top, a strip under the top. o.w, o.h, o.d, o.cut
//   labShelves(p, o)     open shelves over a bench: reagent bottles, boxes, a rack of sample tubes; side boards cut at 45
//                        degrees at the top and the front foot, a strip under the lowest shelf. o.w, o.y0, o.y1, o.d
//   fridgeFront(p, o)    a sample fridge's door over a bench's column of drawers: a handle, a small lit readout. o.x, o.w,
//                        o.top, o.z (the drawers' face)
//   labIsland(p, o)      the island counter: a dark plinth with a toe strip, a white body with drawers on its two long
//                        sides, a charcoal edge and a pale top, all four corners cut. o.w (across), o.len, o.h
//   centrifuge(p)        a squat round machine, its lid, a readout
//   analyser(p)          a white box, its own small screen (a screen() of its own), a sample tray, a light
//   standScreen(p, o)    a small screen on a foot (a screen() of its own: o.live a live programme, o.seed; else o.rect)
import * as THREE from 'three';
import { shape, solid, plate, relief, prism, add } from '../../bevel.js';
import { FACE, NAVY } from './ship.js';
import { screen, glowStrip, FLAT } from './bits.js';
import { spun } from './round.js';
import { segText } from './segtext.js';
import { wallStretcher, glints, BRIGHT_YELLOW, ORANGE, LABEL, DEVICE, PLASTIC, hiddenBack, capsOf } from './medbay.js';

const PI = Math.PI;
// (what never shows is not drawn: medbay.js hiddenBack and capsOf)
const box = (p, look, x0, x1, y0, y1, z0, z1, skip) => p.slab(look, Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), Math.min(z0, z1), Math.max(z0, z1), { r: 0, cell: 9, loops: [], skip: hiddenBack(Math.min(z0, z1), skip) });
const cyl = (p, look, r, h, at, seg = 8, ends) => { const g = capsOf(new THREE.CylinderGeometry(r, r, h, seg, 1), ends); g.translate(...at); return add(p, look, g); };
// a plan with its front corners cut (its back on the wall at FACE), as a FLAT prism from y0 to y1
const planOf = (x0, x1, d, cl, cr) => { const P = [[x0, FACE], [x1, FACE]]; if (cr) P.push([x1, d - cr], [x1 - cr, d]); else P.push([x1, d]); if (cl) P.push([x0 + cl, d], [x0, d - cl]); else P.push([x0, d]); return P.map(([a, b]) => [a, -b]); };
// (medicine boxes: mostly white, a few in colour)
const BOXES = [{ c: '#e2e2dc', r: 0.7 }, { c: '#d9dcd8', r: 0.7 }, { c: '#e6e2d2', r: 0.75 }, { c: '#9cb4d0', r: 0.6 }, { c: '#e2e2dc', r: 0.7 }, { c: '#7fb8b0', r: 0.6 }, { c: '#e8a050', r: 0.6 }];
const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

// ── the drugs cabinet ───────────────────────────────────────────────────────────────────────────────────────────
export function drugsCabinet(p, o = {}) {
  const w = o.w ?? 0.72, h = o.h ?? 2.0, d = o.d ?? 0.24, x0 = -w / 2, x1 = w / 2, c = 0.06, base = 0.08;
  add(p, 'white', prism(planOf(x0, x1, d, c, c), base, h, { back: false }), [0, 0, 0], FLAT);
  add(p, 'dark', prism(planOf(x0 + 0.03, x1 - 0.03, d - 0.035, c, c), 0, base, { front: false, back: false }), [0, 0, 0], FLAT);
  // the inside behind the glass: dark, five shelves of boxes, a light along its top
  const gx0 = x0 + c + 0.02, gx1 = x1 - c - 0.02, gy0 = 0.32, gy1 = h - 0.24, zf = d + 0.001, R = rng(7);
  box(p, 'dark', gx0, gx1, gy0, gy1, zf - 0.004, zf);
  const n = 5, sh = (gy1 - gy0) / n;
  for (let s = 0; s < n; s++) {
    const y = gy0 + s * sh;
    box(p, 'white2', gx0, gx1, y, y + 0.012, zf, zf + 0.012);
    // (boxes lying on their sides, wider than tall, stacked two high here and there; a white bottle now and then)
    for (let x = gx0 + 0.02; x < gx1 - 0.06;) { const bw = 0.06 + R() * 0.05, bh = 0.04 + R() * 0.05, x1 = Math.min(gx1 - 0.02, x + bw), k = R(); if (k > 0.82) { cyl(p, 'white', 0.018, 0.09, [x + 0.02, y + 0.057, zf + 0.006], 5, 'top'); x += 0.05; continue; } box(p, BOXES[Math.floor(R() * BOXES.length)], x, x1, y + 0.012, y + 0.012 + bh, zf + 0.001, zf + 0.008, ['-y']); if (k > 0.55) box(p, BOXES[Math.floor(R() * BOXES.length)], x + 0.005, x1 - 0.005, y + 0.012 + bh, y + 0.012 + bh * 1.9, zf + 0.001, zf + 0.008, ['-y']); x += bw + 0.008; }
  }
  glowStrip(p, gx1 - gx0 - 0.06, [0, gy1 - 0.02, zf + 0.01], [0, 0, 0], { wid: 0.01, i: 0.16, dir: [0, -0.7, 0.7], reach: 1.2 });
  // the two glass doors in dark frames, the lower drawers under them, the keypad lock between them with its red light
  const xm = (gx0 + gx1) / 2;
  for (const [a0, a1] of [[gx0, xm - 0.006], [xm + 0.006, gx1]]) {
    for (const [b0, b1, e0, e1] of [[a0 - 0.012, a1 + 0.012, gy0 - 0.02, gy0], [a0 - 0.012, a1 + 0.012, gy1, gy1 + 0.02], [a0 - 0.012, a0 + 0.004, gy0, gy1], [a1 - 0.004, a1 + 0.012, gy0, gy1]]) box(p, 'black', b0, b1, e0, e1, zf + 0.012, zf + 0.026);
    p.glass(a1 - a0, gy1 - gy0, [(a0 + a1) / 2, (gy0 + gy1) / 2, zf + 0.02]);
    glints(p, a0, a1, gy0, gy1, zf + 0.0215);
  }
  for (let k = 0; k < 2; k++) { const y0 = base + 0.02 + k * 0.11, y1 = y0 + 0.1; add(p, 'white2', relief(shape(x1 - x0 - 2 * c - 0.02, y1 - y0, 0.02, 0, (y0 + y1) / 2), [{ inset: 0, depth: 0.006, bevel: 0.005 }]), [0, 0, d + 0.001]); add(p, o.handle || 'black', plate(shape(0.14, 0.02, 0.007, 0, y1 - 0.03)), [0, 0, d + 0.0075]); }
  box(p, 'black', xm - 0.035, xm + 0.035, 1.05, 1.21, zf + 0.026, zf + 0.036);
  for (let i = 0; i < 9; i++) add(p, [0.5, 1.6, 2.6], plate(shape(0.013, 0.011, 0.002, xm - 0.018 + (i % 3) * 0.018, 1.08 + Math.floor(i / 3) * 0.022)), [0, 0, zf + 0.0365], null, 'glow');
  add(p, [3.4, 0.4, 0.3], plate(shape(0.014, 0.014, 0.004, xm, 1.18)), [0, 0, zf + 0.0365], null, 'glow');
  box(p, LABEL, gx0, gx1, gy1 + 0.06, gy1 + 0.14, d - 0.004, d + 0.002);
  segText(p, 'PHARMACY', { h: 0.034, at: [0, gy1 + 0.1, d + 0.0025], look: 'black', gap: 0.008 });
  return p;
}

// ── the supplies rack ───────────────────────────────────────────────────────────────────────────────────────────
export function suppliesRack(p, o = {}) {
  const w = o.w ?? 1.36, h = o.h ?? 1.9, d = o.d ?? 0.24, x0 = -w / 2, x1 = w / 2, [cl, cr] = o.cut || [0, 0.06];
  // the side boards, cut at the top and the front foot; the top with SUPPLIES on its front and a strip under it
  const side = (x) => add(p, 'white', prism([[FACE, 0], [d - 0.06, 0], [d, 0.06], [d, h - 0.1], [d - 0.1, h], [FACE, h]].map(([a, b]) => [-a, b]), x - 0.012, x + 0.012), [0, 0, 0], [0, PI / 2, 0]);
  const split = x0 + Math.min(0.92, w * 0.6);
  for (const x of [x0 + 0.012, split, x1 - 0.012]) side(x);
  add(p, 'white', prism(planOf(x0, x1, d - 0.05, cl, cr), h - 0.12, h - 0.06, {}), [0, 0, 0], FLAT);
  box(p, LABEL, split + 0.04, x1 - 0.06, h - 0.115, h - 0.065, d - 0.05, d - 0.044);
  segText(p, 'SUPPLIES', { h: 0.03, at: [(split + x1 - 0.02) / 2, h - 0.09, d - 0.0435], look: 'black', gap: 0.007 });
  glowStrip(p, w - 0.1, [0, h - 0.122, (FACE + d - 0.05) / 2], [PI / 2, 0, 0], { wid: 0.012, i: 0.18, dir: [0, -1, 0.2], reach: 1.6, pool: 0.05, poolAt: [0, h - 0.7, d + 0.3] });
  // the left bay: two folding stretchers hung flat against the wall, side by side
  const sw = (split - x0 - 0.06) / 2;
  for (const k of [0, 1]) { const q = new p.constructor(); wallStretcher(q, { x: x0 + 0.03 + sw * (k + 0.5), y0: 0.08, y1: h - 0.2, w: sw - 0.02 }); for (const pt of q.parts) p.parts.push(pt); }
  // the right bay: three shelves; folded blankets (navy and grey), a bin of splints (orange and blue, standing), neck
  // collars (orange)
  for (const y of [0.05, 0.62, 1.18]) box(p, 'white2', split, x1 - 0.024, y, y + 0.022, FACE, d - 0.02);
  const bx0 = split + 0.03, bx1 = x1 - 0.05;
  for (let k = 0; k < 4; k++) box(p, k % 2 ? { c: '#5d6168', r: 0.9 } : NAVY, bx0, bx1, 1.2 + k * 0.07, 1.265 + k * 0.07, FACE + 0.02, d - 0.04, ['-y']);
  for (let k = 0; k < 3; k++) box(p, k % 2 ? NAVY : { c: '#5d6168', r: 0.9 }, bx0, bx1, 0.64 + k * 0.07, 0.705 + k * 0.07, FACE + 0.02, d - 0.04, ['-y']);
  box(p, 'dark', bx0, bx1, 0.072, 0.4, FACE + 0.02, d - 0.03, ['-y']);
  for (let k = 0; k < 6; k++) { const x = bx0 + 0.03 + k * (bx1 - bx0 - 0.06) / 5; box(p, k % 3 ? ORANGE : { c: '#3d6fae', r: 0.6 }, x - 0.018, x + 0.018, 0.2, 0.55 + (k % 2) * 0.06, FACE + 0.05, FACE + 0.08, ['-y']); }
  for (let k = 0; k < 2; k++) box(p, ORANGE, bx0 + 0.02 + k * 0.13, bx0 + 0.12 + k * 0.13, 0.42, 0.5, d - 0.08, d - 0.03);
  box(p, 'dark', bx0, bx1, 0.072, 0.4, d - 0.032, d - 0.028);
  return p;
}

// ── the shelves over the bench ──────────────────────────────────────────────────────────────────────────────────
export function labShelves(p, o = {}) {
  const w = o.w ?? 1.0, y0 = o.y0 ?? 1.4, y1 = o.y1 ?? 2.0, d = o.d ?? 0.25, x0 = -w / 2, x1 = w / 2, R = rng(11);
  for (const x of [x0 + 0.012, x1 - 0.012]) add(p, 'white', prism([[FACE, y0], [d - 0.05, y0], [d, y0 + 0.05], [d, y1 - 0.08], [d - 0.08, y1], [FACE, y1]].map(([a, b]) => [-a, b]), x - 0.012, x + 0.012), [0, 0, 0], [0, PI / 2, 0]);
  const ys = [y0, y0 + (y1 - y0) * 0.5, y1 - 0.025];
  for (const y of ys) box(p, 'white2', x0 + 0.024, x1 - 0.024, y, y + 0.02, FACE, d - 0.01);
  glowStrip(p, w - 0.1, [0, y0 - 0.001, (FACE + d) / 2], [PI / 2, 0, 0], { wid: 0.012, i: o.light ?? 0.24, glow: o.glow, color: o.color, dir: [0, -1, 0.1], reach: 1.4, pool: o.pool ?? 0.08, poolAt: [0, y0 - 0.45, d] });
  // reagent bottles, brown and clear, boxes, and a rack of sample tubes
  for (const y of [ys[0] + 0.02, ys[1] + 0.02]) {
    for (let x = x0 + 0.06; x < x1 - 0.06;) {
      const kind = R();
      if (kind < 0.45) { const r = 0.025 + R() * 0.015, hh = 0.1 + R() * 0.08; cyl(p, R() > 0.5 ? { c: '#6b3d1c', r: 0.15 } : { c: '#c9d8de', r: 0.12 }, r, hh, [x + r, y + hh / 2, FACE + 0.08 + R() * 0.06], 6, 'top'); x += 2 * r + 0.02; }
      else if (kind < 0.7) { const bw = 0.08 + R() * 0.06, bh = 0.05 + R() * 0.05; box(p, BOXES[Math.floor(R() * BOXES.length)], x, x + bw, y, y + bh, FACE + 0.04, d - 0.04, ['-y']); x += bw + 0.015; }
      else { box(p, 'white2', x, x + 0.14, y, y + 0.05, FACE + 0.06, FACE + 0.14, ['-y']); for (let i = 0; i < 5; i++) cyl(p, i % 2 ? { c: '#d9c25a', r: 0.3 } : { c: '#8fd0c8', r: 0.3 }, 0.008, 0.09, [x + 0.018 + i * 0.026, y + 0.07, FACE + 0.1], 5, 'top'); x += 0.16; }
    }
  }
  return p;
}

// ── a sample fridge's door ──────────────────────────────────────────────────────────────────────────────────────
export function fridgeFront(p, o = {}) {
  const x = o.x ?? 0, w = o.w ?? 0.48, top = o.top ?? 0.86, z = o.z ?? 0.48;
  add(p, 'white2', solid(shape(w - 0.02, top - 0.12, 0.02, x, (top + 0.12) / 2), 0.016, { edge: 0.005, back: false }), [0, 0, z]);
  box(p, o.handle || 'black', x + w / 2 - 0.06, x + w / 2 - 0.04, 0.5, 0.75, z + 0.016, z + 0.034);
  add(p, [0.4, 2.4, 3.2], plate(shape(0.08, 0.03, 0.006, x - 0.08, top - 0.08)), [0, 0, z + 0.0165], null, 'glow');
  segText(p, '4C', { h: 0.016, at: [x - 0.08, top - 0.08, z + 0.017], look: 'black', gap: 0.004 });
  return p;
}

// ── the island ──────────────────────────────────────────────────────────────────────────────────────────────────
export function labIsland(p, o = {}) {
  const w = o.w ?? 0.75, len = o.len ?? 1.0, h = o.h ?? 0.9, c = 0.12, oct = (W, L, C) => [[-W / 2 + C, -L / 2], [W / 2 - C, -L / 2], [W / 2, -L / 2 + C], [W / 2, L / 2 - C], [W / 2 - C, L / 2], [-W / 2 + C, L / 2], [-W / 2, L / 2 - C], [-W / 2, -L / 2 + C]];
  add(p, 'dark', prism(oct(w - 0.08, len - 0.08, c - 0.02), 0, 0.1, { front: false, back: false }), [0, 0, 0], FLAT);
  add(p, 'white', prism(oct(w - 0.04, len - 0.04, c - 0.01), 0.1, h - 0.04, { back: false }), [0, 0, 0], FLAT);
  add(p, o.trim || 'black', prism(oct(w + 0.02, len + 0.02, c + 0.01), h - 0.04, h - 0.015, {}), [0, 0, 0], FLAT);
  add(p, { c: '#b4b5b2', r: 0.36, m: 0.25, w: 0.4 }, prism(oct(w, len, c), h - 0.015, h, { back: false }), [0, 0, 0], FLAT);
  // drawers down its two long sides (two columns of three), their handle slots; a strip round its foot
  for (const s of [-1, 1]) {
    const xf = s * (w / 2 - 0.02 + 0.001), L = len - 2 * c - 0.04;
    for (let col = 0; col < 2; col++) for (let r = 0; r < 3; r++) {
      const zc = -L / 2 + L * (col + 0.5) / 2, yc = 0.16 + r * 0.24 + 0.1, g = relief(shape(L / 2 - 0.02, 0.2, 0.02, 0, 0), [{ inset: 0, depth: 0.006, bevel: 0.005 }]);
      add(p, 'white2', g, [xf, yc, zc], [0, s * PI / 2, 0]);
      add(p, o.handle || 'black', plate(shape(0.12, 0.018, 0.006)), [xf + s * 0.0065, yc + 0.06, zc], [0, s * PI / 2, 0]);
    }
    glowStrip(p, len - 2 * c - 0.04, [s * (w / 2 - 0.04 - 0.001), 0.05, 0], [0, s * PI / 2, 0], { wid: 0.01, i: 0.35, dir: [s * 0.8, -0.6, 0], reach: 1.2, pool: 0.12, poolReach: 1.2 });
  }
  return p;
}

// ── on the island ───────────────────────────────────────────────────────────────────────────────────────────────
export function centrifuge(p) {
  add(p, DEVICE, spun([[0.13, 0], [0.13, 0.12], [0.11, 0.15], [0.001, 0.15]], { seg: 10, caps: [false, true] }));
  add(p, { c: '#4a4d53', r: 0.3, m: 0.4, w: 0.3 }, spun([[0.1, 0.15], [0.1, 0.162], [0.04, 0.17], [0.001, 0.17]], { seg: 10, caps: [false, true] }));
  box(p, 'dark', -0.05, 0.05, 0.03, 0.09, 0.122, 0.132);
  add(p, [0.4, 2.6, 1.2], plate(shape(0.06, 0.02, 0.004, 0, 0.07)), [0, 0, 0.1325], null, 'glow');
  return p;
}
export function analyser(p) {
  add(p, DEVICE, solid(shape(0.3, 0.26, 0.03, 0, 0.13), 0.24, { edge: 0.012 }), [0, 0, -0.12]);
  screen(p, { w: 0.12, h: 0.08, live: 'scan', seed: 0.8, bezel: 0.01, depth: 0.006 }, [0.05, 0.17, 0.12]);
  box(p, 'dark', -0.13, -0.02, 0.04, 0.08, 0.1, 0.125);
  box(p, PLASTIC, -0.12, -0.03, 0.08, 0.1, 0.02, 0.12);
  add(p, [0.4, 3.0, 1.2], plate(shape(0.012, 0.012, 0.003, -0.11, 0.2)), [0, 0, 0.1205], null, 'glow');
  return p;
}
export function standScreen(p, o = {}) {
  box(p, 'black', -0.07, 0.07, 0, 0.015, -0.06, 0.06);
  box(p, 'black', -0.012, 0.012, 0.015, 0.16, -0.012, 0.012);
  screen(p, { w: 0.26, h: 0.16, ...(o.live ? { live: o.live, seed: o.seed ?? 0 } : { rect: o.rect || 'math', gain: 1.2 }), bezel: 0.014, depth: 0.012 }, [0, 0.24, 0.012], [-0.15, 0, 0]);
  return p;
}
export { BRIGHT_YELLOW };
