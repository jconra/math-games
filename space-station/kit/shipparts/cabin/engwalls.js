// ENGINEERING'S WALLS, BUSY. The game's maker (2026-11-10): "I'm kind of hoping that the walls can be even more busy
// though. Like maybe some wiring bundles and some boxes with a bunch of switches with lights on them. I'd expect every sq
// inch of an area like that to be used in a real ship. We can try to paint the wires on with cards and use some cheap
// tricks like that to keep that area from growing too expensive."
// So the wiring is mostly PAINTED: a bundle of wires is a flat card on the wall, each wire two flat strips (a dark one and
// a lighter one down its middle, so it reads round), a dark shadow card under the bundle, ties across it every so often.
// Real round cables only where they hang or cross between boxes; thin conduit (small pipes) with clips; boxes of switches
// with a small lamp over each switch (a few on the live 'lamp' programme, blinking slowly); junction boxes; gauges. Every
// box's corners cut at 45 degrees, everything within 0.12 m of the wall's face. All in the cabin's own materials (solid,
// glow, decal, live): no draw is added, whatever is on the walls.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// the wall's face at FACE; y = 0 the deck. The pieces below draw in that frame, at a point given in it.
//   wireCard(p, o)     a painted bundle: o.pts (its middle line, [[x, y], ...] in the card's plane: bends at 45 degrees
//                      read best), o.n (wires, 6), o.wid (a wire's width, 0.011), o.gap (0.002), o.colors (a list of
//                      surfaces, taken in turn; WIRES by default), o.ties (a dark tie across every this far, 0.32; 0 none),
//                      o.at, o.rot (where its plane is: [0, 0, FACE + 0.003] on a wall's face, facing +z, by default)
//   cables(p, o)       real cables hanging between two points: o.a, o.b ([x, y, z]), o.sag (0.12), o.n (2), o.r (0.007),
//                      o.spread (between them, 0.018), o.colors
//   conduit(p, o)      a thin pipe through points on a wall ([x, y] at o.z out), clips every o.clip (0.45): o.pts, o.r
//                      (0.012), o.z (FACE + 0.03), o.look ('rail')
//   breakerBox(p, o)   a box of switches: o.x, o.y (its middle), o.w (0.42), o.h (0.6), o.d (0.085), o.rows (3), o.cols
//                      (6), o.blink ([[row, col], ...]: their lamps on the live 'lamp' programme, slow), o.label (a decal
//                      rect for the stencil on its top margin, 'label:BUS-C'), o.seed (which lamps are which colour)
//   junctionBox(p, o)  a small box with a door: o.x, o.y, o.w (0.24), o.h (0.3), o.d (0.07), o.lamp ('blink' | 'steady'
//                      | null), o.caution (true: a CAUTION plate on its door), o.glands ([top, bottom]: how many)
//   gauges(p, o)       a plate of round dials: o.x, o.y, o.n (2), o.r (a dial's radius, 0.045), o.turn (the needles,
//                      0..1 of the scale each, a list)
//   wallKit(p, o)      a whole stretch of wall, floor to top, filled: o.w (its width), o.top (how high: the ceiling, or
//                      under what hangs there), o.tray (the bundle along its top: true), o.flip (the boxes the other way
//                      round), o.seed, o.label
//   trunking(p, o)     a box along the ceiling where it meets the hull's slope (it also hides the hull's own skin, which
//                      dips under the ceiling there in Explorer C's engineering): o.len (along it, x), o.out (how far in
//                      from the wall line its inner edge is at the ceiling, 1.0), o.foot (how far in the slope starts, 0
//                      at the wall line), o.y0 (the slope's foot), o.drop (its underside, under the ceiling: 0.16),
//                      o.ceiling (2.5); a 45 degree chamfer along its inner edge, a painted bundle on the chamfer,
//                      small lamps along its underside
//   slopeCard(p, o)    a painted bundle along a hull slope (the slope's frame: o.y0, o.run, o.ceiling; at o.s (0..1 up
//                      the slope, 0.45), o.len along it, o.n wires)
import * as THREE from 'three';
import { shape, solid, plate, relief, prism, add } from '../../bevel.js';
import { FACE, ROOM } from './ship.js';
import { FLAT } from './bits.js';
import { GUN, STEEL } from './mess.js';
import { tube, spun, aim } from './round.js';
import { liveLamp } from './live.js';

const PI = Math.PI;
// the wires' colours (surfaces): the ship's own wiring, mostly dark, with the trade colours among it
const w = (c, r = 0.55) => ({ c, r, m: 0.05, w: 0.2 });
export const WIRES = [w('#1d1e21'), w('#9a3020'), w('#3a3c41'), w('#b48e2c'), w('#2c5590'), w('#6a6d73'), w('#357040'), w('#1d1e21'), w('#b9b6ae'), w('#a35a20')];
const lighter = (s) => { const c = new THREE.Color(s.c).lerp(new THREE.Color('#e2e0da'), 0.45); return { ...s, c: '#' + c.getHexString(), r: s.r - 0.2 }; };
const DIAL = { c: '#d9d6cc', r: 0.45, m: 0, w: 0.2 }, SHADOW = { c: '#2a2b2e', r: 0.8, m: 0, w: 0.2 }, TIE = { c: '#151618', r: 0.5, m: 0.1, w: 0.2 }, BOX = { c: '#868a90', r: 0.42, m: 0.35, w: 0.45 };

// ── a flat strip along a line in the xy plane, its two edges `a` and `b` off the line (left of it, as it runs) ──
function offsetLine(P, d) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[i], c = P[Math.min(P.length - 1, i + 1)];
    const t1 = norm2(i ? [b[0] - a[0], b[1] - a[1]] : [c[0] - b[0], c[1] - b[1]]), t2 = norm2(i < P.length - 1 ? [c[0] - b[0], c[1] - b[1]] : t1);
    const n1 = [-t1[1], t1[0]], m = norm2([n1[0] - t2[1], n1[1] + t2[0]]), k = d / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]);
    out.push([b[0] + m[0] * k, b[1] + m[1] * k]);
  }
  return out;
}
const norm2 = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function stripGeo(P, a, b, z = 0) {
  const A = offsetLine(P, a), B = offsetLine(P, b), pos = [], nrm = [], uv = [], ix = [];
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    if (i) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    pos.push(A[i][0], A[i][1], z, B[i][0], B[i][1], z); nrm.push(0, 0, 1, 0, 0, 1); uv.push(s, 0, s, 1);
    if (i) { const k = (i - 1) * 2; ix.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  // (wound to face +z whichever way the line runs)
  const p0 = new THREE.Vector3(...pos.slice(0, 3)), p1 = new THREE.Vector3(...pos.slice(3, 6)), p2 = new THREE.Vector3(...pos.slice(9, 12));
  if (new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0)).z < 0) { for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; g.setIndex(ix); }
  return g;
}
// a point a share t along a line, and its way there
function along(P, t) {
  const L = []; let tot = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(l); tot += l; }
  let d = t * tot; for (let i = 0; i < L.length; i++) { if (d <= L[i] || i === L.length - 1) { const f = Math.min(1, d / (L[i] || 1)), a = P[i], b = P[i + 1]; return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], dir: norm2([b[0] - a[0], b[1] - a[1]]), tot }; } d -= L[i]; }
  return { at: P[0], dir: [1, 0], tot };
}

export function wireCard(p, o = {}) {
  const P = o.pts, n = o.n ?? 6, wd = o.wid ?? 0.013, gap = o.gap ?? 0.002, cols = o.colors || WIRES, at = o.at || [0, 0, FACE + 0.003], rot = o.rot || [0, 0, 0];
  const W = n * (wd + gap) - gap, seed = o.seed ?? 0;
  // the shadow under the bundle, then each wire: dark, a lighter line down its middle
  add(p, SHADOW, stripGeo(P, -W / 2 - 0.004, W / 2 + 0.004, 0), at, rot);
  for (let i = 0; i < n; i++) {
    const c = cols[(i + seed) % cols.length], d0 = -W / 2 + i * (wd + gap);
    add(p, c, stripGeo(P, d0, d0 + wd, 0.0008), at, rot);
    add(p, lighter(c), stripGeo(P, d0 + wd * 0.3, d0 + wd * 0.62, 0.0014), at, rot);
  }
  // the ties: a dark band across the bundle every so often
  const tie = o.ties ?? 0.32, { tot } = along(P, 0);
  if (tie > 0) for (let s = tie / 2; s < tot - 0.03; s += tie) {
    const { at: q, dir } = along(P, s / tot), g = plate(shape(0.009, W + 0.008, 0.002));
    add(p, TIE, g, localOf(at, rot, [q[0], q[1], 0.002]), [rot[0], rot[1], rot[2] + Math.atan2(dir[1], dir[0])]);
  }
  return p;
}
// a point in a plane placed at `at` turned by `rot`
const _e = new THREE.Euler(), _v = new THREE.Vector3();
const localOf = (at, rot, v) => { _v.set(...v).applyEuler(_e.set(...rot)); return [at[0] + _v.x, at[1] + _v.y, at[2] + _v.z]; };

export function cables(p, o = {}) {
  const a = o.a, b = o.b, sag = o.sag ?? 0.12, n = o.n ?? 2, r = o.r ?? 0.007, sp = o.spread ?? 0.018, cols = o.colors || [WIRES[0], WIRES[3], WIRES[4]];
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * sp, pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, s = sag * (1 + k * 0.25) * 4 * t * (1 - t); pts.push([a[0] + (b[0] - a[0]) * t + off * 0.3, a[1] + (b[1] - a[1]) * t - s + off, a[2] + (b[2] - a[2]) * t + off * 0.5]); }
    add(p, cols[k % cols.length], tube(pts, r, { seg: 6, bend: 0.001 }));
  }
  return p;
}

export function conduit(p, o = {}) {
  const r = o.r ?? 0.012, z = o.z ?? FACE + 0.03, look = o.look || 'rail', P = o.pts.map(([x, y]) => [x, y, z]);
  add(p, look, tube(P, r, { seg: 8, bend: 0.06 }));
  // (clips: a small plate over the pipe, screwed to the wall, every so often along each leg)
  const every = o.clip ?? 0.45;
  for (let i = 1; i < P.length; i++) {
    const A = P[i - 1], B = P[i], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 0.15) continue;
    const m = Math.max(1, Math.round(L / every)), ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
    for (let j = 0; j < m; j++) { const t = (j + 0.5) / m, q = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]; add(p, GUN, solid(shape(0.016, 2 * r + 0.03, 0.005), z - FACE + r + 0.002, { edge: 0.002, back: false }), [q[0], q[1], FACE], [0, 0, ang]); }
  }
  return p;
}

// ── boxes ───────────────────────────────────────────────────────────────────────────────────────────────────────
// (a box on the wall: its front a recessed panel inside a bevelled lip; returns the front's level)
function boxBody(p, look, x, y, bw, bh, d, c = 0.03) {
  add(p, look, solid(shape(bw, bh, c, x, y), d, { edge: 0.008, back: false, front: [{ inset: 0.022, depth: -0.006, bevel: 0.005 }] }), [0, 0, FACE]);
  return FACE + d - 0.006;
}
// a toggle switch on a face at z: a dark base, its lever tipped up (+1) or down (-1)
function toggle(p, x, y, z, up) {
  add(p, 'black', plate(shape(0.026, 0.036, 0.006, x, y)), [0, 0, z + 0.0006]);
  const s = up > 0 ? 1 : -1, pts = [[0, -0.004], [0.004, -0.004], [0.017, 0.012 * s + 0.004], [0.013, 0.012 * s + 0.007]].map(([zz, yy]) => [zz, yy]);
  add(p, 'rail', prism(pts, -0.0035, 0.0035), [x, y, z], [0, -PI / 2, 0]);
}
const LAMPS = ['green', 'green', 'amber', 'green', 'red', 'green', 'blue', 'green'];
export function breakerBox(p, o = {}) {
  const x = o.x ?? 0, y = o.y ?? 1.4, bw = o.w ?? 0.42, bh = o.h ?? 0.6, d = o.d ?? 0.085, rows = o.rows ?? 3, cols = o.cols ?? 6, seed = o.seed ?? 0;
  const z = boxBody(p, BOX, x, y, bw, bh, d), blink = o.blink || [];
  // its rows of switches, each with its lamp over it and a strip of tags under the row
  const top = y + bh / 2 - 0.1, rh = (bh - 0.16) / rows, cw = (bw - 0.07) / cols;
  for (let r = 0; r < rows; r++) {
    const ry = top - rh * (r + 0.5) + 0.01;
    for (let c = 0; c < cols; c++) {
      const cx = x - bw / 2 + 0.035 + cw * (c + 0.5), k = (r * cols + c + seed) % 7;
      toggle(p, cx, ry - 0.006, z, k === 3 || k === 5 ? -1 : 1);
      const lamp = LAMPS[(r * 5 + c * 3 + seed) % LAMPS.length], B = blink.findIndex(([br, bc]) => br === r && bc === c);
      if (B >= 0) liveLamp(p, { w: 0.012, h: 0.012, mode: 'blink', every: 4 + ((B * 3 + seed) % 4), glow: lamp, phase: ((B * 0.37 + seed * 0.21) % 1) }, [cx, ry + 0.03, z + 0.0012]);
      else add(p, lamp, plate(shape(0.011, 0.011, 0.003, cx, ry + 0.03)), [0, 0, z + 0.0012], null, 'glow');
    }
    p.decal('breakerTags', bw - 0.08, 0.022, [x, ry - 0.04, z + 0.001], null, '#cfccc4');
  }
  // the stencil over them (its name), a hazard band under them
  // (the station's own stencils, kit/tex.js LABELS: 'label:BUS-C', 'label:BUS-D', 'label:AIR-2' ...)
  if (o.label) p.decal(o.label, Math.min(0.2, bw - 0.12), Math.min(0.2, bw - 0.12) / 4, [x, y + bh / 2 - 0.048, z + 0.001], null, '#2c2e32');
  return p;
}
export function junctionBox(p, o = {}) {
  const x = o.x ?? 0, y = o.y ?? 0.6, bw = o.w ?? 0.24, bh = o.h ?? 0.3, d = o.d ?? 0.07;
  add(p, BOX, solid(shape(bw, bh, 0.025, x, y), d, { edge: 0.006, back: false }), [0, 0, FACE]);
  const z = FACE + d;
  add(p, 'grey2', relief(shape(bw - 0.03, bh - 0.03, 0.02, x, y), [{ inset: 0, depth: 0.004, bevel: 0.004 }, { inset: 0.018, depth: 0.0015, bevel: 0.003 }]), [0, 0, z]);
  add(p, 'black', plate(shape(0.018, 0.07, 0.006, x + bw / 2 - 0.035, y)), [0, 0, z + 0.0045]);
  if (o.caution !== false) p.decal('cp:caution', bw * 0.6, bw * 0.15, [x - 0.01, y + bh / 2 - 0.06, z + 0.0046], null, '#c9a032');
  if (o.lamp === 'blink') liveLamp(p, { w: 0.014, h: 0.014, mode: 'blink', every: 5, glow: 'amber', phase: (o.seed ?? 0) * 0.3 % 1 }, [x - bw / 2 + 0.035, y - bh / 2 + 0.035, z + 0.0046]);
  else if (o.lamp !== null) add(p, 'green', plate(shape(0.013, 0.013, 0.004, x - bw / 2 + 0.035, y - bh / 2 + 0.035)), [0, 0, z + 0.0046], null, 'glow');
  // glands, where its cables go in: on its top and its foot
  const [gt, gb] = o.glands || [2, 1];
  for (const [ny, sg] of [[gt, 1], [gb, -1]]) for (let i = 0; i < ny; i++) add(p, GUN, aim(spun([[0.013, 0], [0.013, 0.012], [0.009, 0.02]], { seg: 8, caps: [false, true] }), [x + (i - (ny - 1) / 2) * 0.05, y + sg * bh / 2, FACE + d / 2], [0, sg, 0]));
  return p;
}
export function gauges(p, o = {}) {
  const x = o.x ?? 0, y = o.y ?? 1.8, n = o.n ?? 2, r = o.r ?? 0.045, turn = o.turn || [0.62, 0.35, 0.8], pw = n * (2 * r + 0.03) + 0.03, ph = 2 * r + 0.06;
  add(p, 'black', solid(shape(pw, ph, 0.02, x, y), 0.018, { edge: 0.004, back: false }), [0, 0, FACE]);
  const z = FACE + 0.018;
  for (let i = 0; i < n; i++) {
    const cx = x - pw / 2 + 0.03 + r + i * (2 * r + 0.03);
    add(p, STEEL, aim(spun([[r * 0.86, 0], [r, 0.004], [r, 0.012], [r * 0.86, 0.016]], { seg: 16, caps: [false, false] }), [cx, y + 0.005, z], [0, 0, 1]));
    add(p, DIAL, plate(shape(r * 1.72, r * 1.72, r * 1.72 * 0.293, cx, y + 0.005)), [0, 0, z + 0.004]);
    p.decal('cp:ticks', r * 1.6, r * 1.6, [cx, y + 0.005, z + 0.0048], null, '#2a2c30');
    const a = PI * (1.25 - 1.5 * (turn[i % turn.length] ?? 0.5));
    add(p, 'red', plate(shape(r * 0.75, 0.004, 0.0015, r * 0.3, 0)), [cx, y + 0.005, z + 0.0056], [0, 0, a]);
  }
  return p;
}

// ── a whole stretch of wall ─────────────────────────────────────────────────────────────────────────────────────
// (in its own x from -w/2 to w/2; its things kept 0.03 in from each end)
export function wallKit(p, o = {}) {
  const W = o.w ?? 1, top = o.top ?? 2.45, f = o.flip ? -1 : 1, seed = o.seed ?? 0, e = W / 2 - 0.03;
  const bwid = Math.min(0.42, W * 0.48), bx = f * (e - bwid / 2), ox = -f * (e - 0.17), by = Math.min(1.46, top - 0.75);
  // the bundle along its top, dropping at 45 degrees to the box of switches, on down its side to the deck
  const ty = top - 0.14;
  if (o.tray !== false) wireCard(p, { pts: [[-W / 2, ty], [W / 2, ty]], n: 9, seed, ties: 0.28 });
  const dx = bx - f * 0.08;
  wireCard(p, { pts: [[dx + f * 0.12, ty], [dx, ty - 0.12], [dx, by + 0.31]], n: 5, seed: seed + 3, ties: 0.25 });
  breakerBox(p, { x: bx, y: by, w: bwid, h: 0.6, rows: 3, cols: bwid > 0.36 ? 6 : 5, blink: [[0, (seed + 1) % 5], [2, (seed + 3) % 5]], label: o.label || 'label:BUS-C', seed });
  // two conduits down from under it to the deck; a painted run of wires beside them
  for (const k of [-1, 1]) conduit(p, { pts: [[bx + k * 0.1, by - 0.3], [bx + k * 0.1, 0.12]], z: FACE + 0.024, r: 0.011 });
  wireCard(p, { pts: [[bx - f * (bwid / 2 - 0.03), by - 0.3], [bx - f * (bwid / 2 - 0.03), 0.16]], n: 4, seed: seed + 6, ties: 0.3 });
  // on the other side: the gauges high, a junction box low, a hanging pair of cables between it and the box of switches,
  // a conduit from it up to the bundle
  gauges(p, { x: ox, y: by + 0.2, n: 2, turn: [0.3 + 0.1 * seed, 0.7] });
  const jy = 0.62;
  junctionBox(p, { x: ox, y: jy, lamp: 'blink', seed });
  cables(p, { a: [bx - f * bwid / 2, by - 0.18, FACE + 0.06], b: [ox + f * 0.06, jy + 0.15, FACE + 0.04], sag: 0.14, n: 2 });
  conduit(p, { pts: [[ox - f * 0.07, jy + 0.15], [ox - f * 0.07, by - 0.02], [ox - f * 0.07 - f * 0.08, by + 0.06], [ox - f * 0.07 - f * 0.08, ty - 0.03]], z: FACE + 0.02, r: 0.01 });
  // a small plate of three more lamps and a key switch between the gauges and the junction box
  const ly = (jy + by) / 2 - 0.02;
  add(p, 'black', solid(shape(0.15, 0.07, 0.015, ox, ly), 0.012, { edge: 0.003, back: false }), [0, 0, FACE]);
  for (let i = 0; i < 3; i++) add(p, ['green', 'amber', 'green'][(i + seed) % 3], plate(shape(0.014, 0.014, 0.004, ox - 0.04 + i * 0.03, ly + 0.012)), [0, 0, FACE + 0.0125], null, 'glow');
  add(p, 'rail', plate(shape(0.022, 0.022, 0.011, ox + 0.05, ly + 0.012)), [0, 0, FACE + 0.0125]);
  p.decal('label:' + (seed % 2 ? 'AIR-2' : 'FUEL'), 0.1, 0.025, [ox - 0.01, ly - 0.02, FACE + 0.0125], null, '#cfccc4');
  // its lower half: a bundle across it at waist height (behind the conduits), dropping into a terminal box along its foot
  // (a long low box, a row of lamps and tags on it), a small pipe along the deck under that
  const wy = 0.98;
  wireCard(p, { pts: [[-W / 2, wy], [ox + f * 0.16, wy], [ox + f * 0.08, wy - 0.08], [ox + f * 0.08, jy + 0.16]], n: 7, seed: seed + 2, ties: 0.26 });
  wireCard(p, { pts: [[bx - f * 0.02, wy + 0.06], [W / 2 * f, wy + 0.06]].sort((a, b) => a[0] - b[0]), n: 6, seed: seed + 5, ties: 0.3 });
  const tw = W - 0.14, ty0 = 0.3;
  boxBody(p, BOX, 0, ty0, tw, 0.15, 0.06, 0.02);
  for (let i = 0; i < 7; i++) { const lx = -tw / 2 + 0.06 + i * (tw - 0.12) / 6; add(p, LAMPS[(i * 3 + seed) % LAMPS.length], plate(shape(0.012, 0.012, 0.003, lx, ty0 + 0.035)), [0, 0, FACE + 0.055], null, 'glow'); }
  p.decal('breakerTags', tw - 0.1, 0.03, [0, ty0 - 0.02, FACE + 0.0545], null, '#cfccc4');
  conduit(p, { pts: [[-W / 2, 0.13], [W / 2, 0.13]], z: FACE + 0.03, r: 0.014, look: seed % 2 ? 'yellow' : 'rail', clip: 0.35 });
  return p;
}

// ── along the ceiling's edge, and on the hull's slopes ─────────────────────────────────────────────────────────
// (both in the frame of the wall line the slope stands on: x along it, z in from the line, y up)
export function trunking(p, o = {}) {
  const len = o.len ?? 1.5, ceil = o.ceiling ?? ROOM, y0 = o.y0 ?? 2.0, out = o.out ?? 1.0, drop = o.drop ?? 0.16, yb = ceil - drop;
  // its section (z in from the line, y): up the slope from where the underside meets it, along the underside, up the
  // 45-degree chamfer to the ceiling at `out`, back along the ceiling to where the slope meets it
  const zs = (y) => FACE + (y - y0), zb = zs(yb), zc = Math.max(zb + 0.05, out - drop), sect = [[zs(yb), yb], [zc, yb], [out, ceil], [zs(ceil) - 0.01, ceil]];
  add(p, BOX, prism(sect.map(([zz, yy]) => [zz, yy]), -len / 2, len / 2), [0, 0, 0], [0, -PI / 2, 0]);
  // (its ends: plain caps are the prism's own faces)
  // the painted bundle along its chamfer, the length of it (the chamfer faces down and in, at 45 degrees: a card drawn
  // facing +z, turned a quarter of a half turn about x, faces so)
  const cz = (zc + out) / 2 + 0.002 * Math.SQRT1_2, cy = (yb + ceil) / 2 - 0.002 * Math.SQRT1_2;
  wireCard(p, { pts: [[-len / 2 + 0.02, 0], [len / 2 - 0.02, 0]], n: 7, ties: 0.3, seed: o.seed ?? 2, at: [0, cy, cz], rot: [PI / 4, 0, 0] });
  // small lamps along its underside, every half metre: green, one amber that blinks
  for (let x = -len / 2 + 0.25, i = 0; x < len / 2; x += 0.5, i++) {
    if (i === 1) liveLamp(p, { w: 0.03, h: 0.012, mode: 'blink', every: 6, glow: 'amber', phase: 0.4 }, [x, yb - 0.001, (zb + zc) / 2], [PI / 2, 0, 0]);
    else add(p, 'green', plate(shape(0.03, 0.012, 0.004)), [x, yb - 0.001, (zb + zc) / 2], [PI / 2, 0, 0], 'glow');
  }
  return p;
}
export function slopeCard(p, o = {}) {
  const y0 = o.y0 ?? 2.0, run = o.run ?? 0.5, ceil = o.ceiling ?? ROOM, rise = ceil - y0, L = Math.hypot(rise, run), a = Math.atan2(run, rise), s = (o.s ?? 0.45) * L, len = o.len ?? 1.5;
  // (on the slope's face: up it by s from its foot, a little off it)
  const at = [0, y0 + s * Math.cos(a) - 0.014 * Math.sin(a), FACE + s * Math.sin(a) + 0.014 * Math.cos(a)];
  wireCard(p, { pts: [[-len / 2, 0], [len / 2, 0]], n: o.n ?? 8, ties: 0.34, seed: o.seed ?? 4, at, rot: [a, 0, 0] });
  return p;
}
