// THE CABIN'S SMALL SHARED BITS, in the bevel helper's language (kit/bevel.js), for the rooms' fittings:
//   screen(p, o, at, rot)      a glowing screen from the kit's screen sheet (kit/tex.js SCREEN_RECT: 'math', a sum waiting
//                              for its answer; 'status', life support's bars; 'terminal'; 'radar'), in a chamfered bezel:
//                              o.w, o.h (the screen), o.rect, o.sub ([u0, v0, u1, v1]: a part of the rect), o.oct (an
//                              8-sided screen: its chamfer), o.bezel (the bezel's width, 0.025), o.gain (1.4), o.depth
//                              (how far the bezel stands out, 0.018); o.light: its glow's light for the bake (strength)
//   starScreen(p, o)           (a part: part(starScreen, o)) an 8-sided screen showing a star field, the game's maker's
//                              8-sided holes from his bunk picture: no windows anywhere, screens instead (2026-11-09). A
//                              dark field, glowing specks, a planet's lit edge (o.planet); o.w, o.h, o.seed; facing +z,
//                              centred on its origin, its back at z = 0
//   printed(p, key, w, h, at, rot, tint)   the cabin's print (kit/shipparts/cabin/print.js): 'label:samples', 'num:3' ...
//   glowStrip(p, len, at, rot, o)          a light strip (a glow plate, len x o.wid) facing +z before it is turned, its
//                              lights for the bake every 0.5 m (o.i, o.dir, o.reach) and its pool (o.pool, o.poolAt)
//   hazard(p, len, wid, at, rot)           yellow-and-dark hatching (the station's hazard print, tinted), in 4:1 tiles
//   pipe(p, surf, a, b, r, o)              a straight 8-sided pipe from a to b along one axis, flanged ends (o.flange)
// Every bit draws into piece p, at `at`, turned by `rot` (kit/geo.js put), facing +z before it is turned.
import * as THREE from 'three';
import { shape, solid, loft, plate, add } from '../../bevel.js';
import { kitTextures } from '../../materials.js';
import { plane } from '../../geo.js';
import { SCREEN_RECT } from '../../tex.js';
import { pool, strip, pictureLight, LIGHT, leatherOf, decalQuad } from './mess.js';
export { pool, strip, pictureLight, LIGHT, leatherOf, decalQuad };

const PI = Math.PI;
export const FLAT = [-PI / 2, 0, 0];   // (a shape drawn in x, y lies down, its y running to -z, its depth up)
export const SKY = { c: '#070a12', r: 0.14, m: 0.2, w: 0.02 };      // a screen's dark field
export const GLASSY = { c: '#0d131b', r: 0.1, m: 0.3, w: 0.05 };    // dark glass, a mirror's face
export const COPPER = { c: '#9a5a34', r: 0.38, m: 0.75, w: 0.4 };   // pipes, as his concept's engineering
export const YELLOW = 'yellow';
const K = 2 - Math.SQRT2;
// a deterministic shuffle of numbers (a star field drawn the same every time)
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0) / 4294967296); };

// ── a screen in a bezel ─────────────────────────────────────────────────────────────────────────────────────────
const rectOf = (rect, sub) => { const R = typeof rect === 'string' ? SCREEN_RECT[rect] : rect; if (!R) throw new Error('kit: no screen ' + rect); if (!sub) return R; const [a, b, c, d] = R; return [a + (c - a) * sub[0], b + (d - b) * sub[1], a + (c - a) * sub[2], b + (d - b) * sub[3]]; };
// an 8-sided plate whose uv runs over the rect (the screen sheet's), w x h
function octScreen(w, h, c, R) {
  const g = plate(shape(w, h, c)), uv = g.attributes.uv.array, P = g.attributes.position.array;
  for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = R[0] + (P[i * 3] / w + 0.5) * (R[2] - R[0]); uv[i * 2 + 1] = R[1] + (P[i * 3 + 1] / h + 0.5) * (R[3] - R[1]); }
  return g;
}
export function screen(p, o = {}, at = [0, 0, 0], rot = [0, 0, 0]) {
  const w = o.w ?? 0.5, h = o.h ?? 0.3, b = o.bezel ?? 0.025, d = o.depth ?? 0.018, c = o.oct ?? 0.012, gain = o.gain ?? 1.4;
  add(p, o.frame || 'black', solid(shape(w + 2 * b, h + 2 * b, c + b * K), d, { edge: 0.005, back: false, front: [{ inset: 0, depth: 0.003, bevel: 0.003 }, { inset: Math.max(0.002, b - 0.016), depth: -0.004, bevel: 0.004 }] }), at, rot);
  add(p, [gain, gain, gain], octScreen(w, h, c, rectOf(o.rect || 'math', o.sub)), localAt(at, rot, [0, 0, d - 0.004 + 0.0012]), rot, 'screen');
  if (o.light) strip(p, localAt(at, rot, [0, 0, d + 0.12]), o.light, dirOf(rot, [0, 0, 1]), 1.6, o.lightColor || [0.6, 0.8, 1.0]);
  return p;
}
// a point given in a bit's own frame (turned by rot, then moved to at), and a direction turned by rot
const _e = new THREE.Euler(), _v = new THREE.Vector3();
export const localAt = (at, rot, v) => { _v.set(...v).applyEuler(_e.set(...(rot || [0, 0, 0]))); return [at[0] + _v.x, at[1] + _v.y, at[2] + _v.z]; };
export const dirOf = (rot, v) => _v.set(...v).applyEuler(_e.set(...(rot || [0, 0, 0]))).toArray();

// ── an 8-sided star screen (a part) ─────────────────────────────────────────────────────────────────────────────
export function starScreen(p, o = {}) {
  const w = o.w ?? 0.6, h = o.h ?? 0.34, c = o.c ?? Math.min(w, h) * 0.26, b = 0.03, R = rng(o.seed ?? 7);
  // the bezel: a charcoal frame stepping down to the screen; the dark field in it
  add(p, 'black', solid(shape(w + 2 * b, h + 2 * b, c + b * K), 0.02, { edge: 0.006, back: false, front: [{ inset: 0, depth: 0.004, bevel: 0.004 }, { inset: 0.012, depth: -0.006, bevel: 0.006 }] }));
  add(p, SKY, plate(shape(w, h, c)), [0, 0, 0.0145]);
  // the stars and the planet: one glow geometry, its colours per vertex (a star white to pale blue, brighter ones for the
  // glow to catch; the planet's disc dark, its rim lit on one side)
  const pos = [], col = [], idx = [], z = 0.0152, inner = shape(w - 0.03, h - 0.03, Math.max(0, c - 0.03 * K)), O = octagon2(inner);
  const inside = (x, y) => O.every(([ax, ay], i) => { const [bx, by] = O[(i + 1) % O.length]; return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0; });
  const quad = (x, y, s, k) => { const n = pos.length / 3; pos.push(x - s, y - s, z, x + s, y - s, z, x + s, y + s, z, x - s, y + s, z); for (let i = 0; i < 4; i++) col.push(k * 0.9, k * 0.95, k * 1.1); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const planet = o.planet !== false, pr = h * 0.62, px = w * 0.34, py = -h * 0.62;
  for (let i = 0, tries = 0; i < (o.stars ?? 22) && tries < 400; tries++) {
    const x = (R() - 0.5) * w, y = (R() - 0.5) * h; if (!inside(x, y) || (planet && Math.hypot(x - px, y - py) < pr + 0.01)) continue;
    const big = R() < 0.18; quad(x, y, big ? 0.0042 : 0.0024, big ? 2.2 + R() : 0.7 + R() * 0.9); i++;
  }
  if (planet) {
    // (a fan: its middle dark, its rim lit toward the upper left; only the part inside the screen: points outside are
    // pulled in along the rim to the screen's edge... kept simple: the arc's points clamped inside)
    const n0 = pos.length / 3, N = 20, lit = (a) => Math.max(0, Math.cos(a - 2.3));
    pos.push(px, py, z); col.push(0.02, 0.04, 0.09);
    for (let i = 0; i <= N; i++) {
      const a = PI * 0.5 + (PI * 0.62) * (i / N), x = px + Math.cos(a) * pr, y = py + Math.sin(a) * pr, k = lit(a);
      const [cx, cy] = clampIn(O, x, y, px, py); pos.push(cx, cy, z); col.push(0.04 + 0.22 * k, 0.07 + 0.42 * k, 0.16 + 0.85 * k);
    }
    for (let i = 0; i < N; i++) idx.push(n0, n0 + 1 + i, n0 + 2 + i);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3)); g.setIndex(idx);
  add(p, [1, 1, 1], g, [0, 0, 0], [0, 0, 0], 'glow'); g.attributes.color.array.set(col);
  return p;
}
// (the 8 corners of a shape, counter-clockwise, its repeats dropped)
function octagon2(s) { const pts = []; for (const q of octagonPts(s)) { const l = pts[pts.length - 1]; if (!l || Math.abs(l[0] - q[0]) > 1e-7 || Math.abs(l[1] - q[1]) > 1e-7) pts.push(q); } return pts; }
function octagonPts(s) { const hw = s.w / 2, hh = s.h / 2, [a, b, c, d] = s.c, x = s.x, y = s.y; return [[x - hw + a, y - hh], [x + hw - b, y - hh], [x + hw, y - hh + b], [x + hw, y + hh - c], [x + hw - c, y + hh], [x - hw + d, y + hh], [x - hw, y + hh - d], [x - hw, y - hh + a]]; }
// (a point pulled toward (ox, oy) until it is inside the outline O)
function clampIn(O, x, y, ox, oy) {
  const inside = (u, v) => O.every(([ax, ay], i) => { const [bx, by] = O[(i + 1) % O.length]; return (bx - ax) * (v - ay) - (by - ay) * (u - ax) >= -1e-9; });
  if (inside(x, y)) return [x, y];
  let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (inside(ox + (x - ox) * m, oy + (y - oy) * m)) lo = m; else hi = m; }
  return [ox + (x - ox) * lo, oy + (y - oy) * lo];
}

// ── print, strips, hatching, pipes ───────────────────────────────────────────────────────────────────────────────
export function printed(p, key, w, h, at, rot, tint = '#d9d7cf') { return add(p, tint, decalQuad(w, h, 'cabin:' + key), at, rot, 'decal'); }
export function glowStrip(p, len, at, rot, o = {}) {
  const wid = o.wid ?? 0.014;
  add(p, o.glow || 'white', plate(shape(len, wid, Math.min(wid / 2, 0.004))), at, rot, 'glow');
  const dir = o.dir ? dirOf(rot, o.dir) : dirOf(rot, [0, 0, 1]);
  if (o.i !== 0) for (let x = -len / 2 + Math.min(0.25, len / 2); x < len / 2 + 1e-6; x += 0.5) strip(p, localAt(at, rot, [x, 0, 0.03]), o.i ?? 0.3, dir, o.reach ?? 1.6, o.color);
  if (o.pool) pool(p, o.poolAt || localAt(at, rot, [0, 0, 0.3]), o.pool * Math.max(0.5, len), o.poolReach ?? 1.6, o.color);
  return p;
}
export function hazard(p, len, wid, at, rot) {
  const r = kitTextures().decal.rect.hazard, n = Math.max(1, Math.round(len / (wid * 4))), tw = len / n;
  for (let i = 0; i < n; i++) add(p, '#c9a032', plane(tw, wid, { uv: r, cell: 9 }), localAt(at, rot, [-len / 2 + tw * (i + 0.5), 0, 0]), rot, 'decal');
  return p;
}
// (axis-aligned: a and b differ along one axis)
export function pipe(p, surf, a, b, r = 0.04, o = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ax = d.map(Math.abs).indexOf(Math.max(...d.map(Math.abs))), len = Math.abs(d[ax]), sg = Math.sign(d[ax]);
  const rot = ax === 2 ? [0, sg > 0 ? 0 : PI, 0] : ax === 1 ? [sg > 0 ? -PI / 2 : PI / 2, 0, 0] : [0, sg > 0 ? PI / 2 : -PI / 2, 0];
  const S = (q, z) => ({ s: shape(2 * q, 2 * q, 2 * q * 0.29), z });
  add(p, surf, loft([S(r, 0), S(r, len)], { start: o.start ?? false, end: o.end ?? false }), a, rot);
  if (o.flange !== false) for (const z of [o.flange0 ?? 0, len - (o.flange1 ?? 0) - 0.03]) add(p, o.flangeSurf || 'black', loft([S(r * 1.45, z), S(r * 1.45, z + 0.03)]), a, rot);
  return p;
}
