// THE CABIN'S SMALL SHARED BITS, in the bevel helper's language (kit/bevel.js), for the rooms' fittings:
//   screen(p, o, at, rot)      a glowing screen from the kit's screen sheet (kit/tex.js SCREEN_RECT: 'math', a sum waiting
//                              for its answer; 'status', life support's bars; 'terminal'; 'radar'), in a chamfered bezel:
//                              o.w, o.h (the screen), o.rect, o.sub ([u0, v0, u1, v1]: a part of the rect), o.oct (an
//                              8-sided screen: its chamfer), o.bezel (the bezel's width, 0.025), o.gain (1.4), o.depth
//                              (how far the bezel stands out, 0.018); o.light: its glow's light for the bake (strength);
//                              o.live: a LIVE screen instead (kit/shipparts/cabin/live.js SHOWS: a programme's name or
//                              number, 'survey', 'log' ...), o.seed (0..1) so two alike do not move in step
//   starScreen(p, o)           (a part: part(starScreen, o)) an 8-sided screen, the game's maker's 8-sided holes from his
//                              bunk picture: no windows anywhere, screens instead (2026-11-09). A live screen: the wire
//                              planet turning, or o.show (another programme); o.w, o.h, o.seed; facing +z, centred on
//                              its origin, its back at z = 0
//   printed(p, key, w, h, at, rot, tint)   the cabin's print (kit/shipparts/cabin/print.js): 'label:samples', 'num:3' ...
//   glowStrip(p, len, at, rot, o)          a light strip (a glow plate, len x o.wid) facing +z before it is turned, its
//                              lights for the bake every 0.5 m (o.i, o.dir, o.reach) and its pool (o.pool, o.poolAt);
//                              o.flicker: the ship's one tired strip (live.js), its pool tagged FLICKER_TAG
//   hazard(p, len, wid, at, rot)           yellow-and-dark hatching (the station's hazard print, tinted), in 4:1 tiles
//   pipe(p, surf, a, b, r, o)              a straight 8-sided pipe from a to b along one axis, flanged ends (o.flange)
// Every bit draws into piece p, at `at`, turned by `rot` (kit/geo.js put), facing +z before it is turned.
import * as THREE from 'three';
import { shape, solid, loft, plate, add } from '../../bevel.js';
import { kitTextures } from '../../materials.js';
import { plane } from '../../geo.js';
import { SCREEN_RECT } from '../../tex.js';
import { pool, strip, pictureLight, LIGHT, leatherOf, decalQuad } from './mess.js';
import { liveFace, liveLamp, FLICKER_TAG } from './live.js';
export { pool, strip, pictureLight, LIGHT, leatherOf, decalQuad };

const PI = Math.PI;
export const FLAT = [-PI / 2, 0, 0];   // (a shape drawn in x, y lies down, its y running to -z, its depth up)
export const SKY = { c: '#070a12', r: 0.14, m: 0.2, w: 0.02 };      // a screen's dark field
export const GLASSY = { c: '#0d131b', r: 0.1, m: 0.3, w: 0.05 };    // dark glass, a mirror's face
export const COPPER = { c: '#9a5a34', r: 0.38, m: 0.75, w: 0.4 };   // pipes, as his concept's engineering
export const YELLOW = 'yellow';
const K = 2 - Math.SQRT2;

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
  // (o.live: a live screen instead, kit/shipparts/cabin/live.js: a programme's name or number, o.seed 0..1, o.liveGain)
  if (o.live) liveFace(p, { show: o.live, seed: o.seed ?? 0, w, h, c, gain: o.liveGain ?? 1 }, localAt(at, rot, [0, 0, d - 0.004 + 0.0012]), rot);
  else add(p, [gain, gain, gain], octScreen(w, h, c, rectOf(o.rect || 'math', o.sub)), localAt(at, rot, [0, 0, d - 0.004 + 0.0012]), rot, 'screen');
  if (o.light) strip(p, localAt(at, rot, [0, 0, d + 0.12]), o.light, dirOf(rot, [0, 0, 1]), 1.6, o.lightColor || [0.6, 0.8, 1.0]);
  return p;
}
// a point given in a bit's own frame (turned by rot, then moved to at), and a direction turned by rot
const _e = new THREE.Euler(), _v = new THREE.Vector3();
export const localAt = (at, rot, v) => { _v.set(...v).applyEuler(_e.set(...(rot || [0, 0, 0]))); return [at[0] + _v.x, at[1] + _v.y, at[2] + _v.z]; };
export const dirOf = (rot, v) => _v.set(...v).applyEuler(_e.set(...(rot || [0, 0, 0]))).toArray();

// ── an 8-sided star screen (a part) ─────────────────────────────────────────────────────────────────────────────
export function starScreen(p, o = {}) {
  const w = o.w ?? 0.6, h = o.h ?? 0.34, c = o.c ?? Math.min(w, h) * 0.26, b = 0.03;
  // the bezel: a charcoal frame stepping down to the screen
  add(p, 'black', solid(shape(w + 2 * b, h + 2 * b, c + b * K), 0.02, { edge: 0.006, back: false, front: [{ inset: 0, depth: 0.004, bevel: 0.004 }, { inset: 0.012, depth: -0.006, bevel: 0.006 }] }));
  // the face: a live screen (kit/shipparts/cabin/live.js), plainly a display, not a painted window: the wire planet
  // turning unless o.show names another programme. (The painted stars and planet it showed until 2026-11-10 read as a
  // window that was not one.) o.seed: a whole number, as before; two screens with different seeds do not move in step.
  liveFace(p, { show: o.show ?? 'survey', seed: ((o.seed ?? 7) * 0.137) % 1, w, h, c }, [0, 0, 0.0145]);
  return p;
}

// ── print, strips, hatching, pipes ───────────────────────────────────────────────────────────────────────────────
export function printed(p, key, w, h, at, rot, tint = '#d9d7cf') { return add(p, tint, decalQuad(w, h, 'cabin:' + key), at, rot, 'decal'); }
export function glowStrip(p, len, at, rot, o = {}) {
  const wid = o.wid ?? 0.014;
  // (o.flicker: THE tired strip, one on a ship (kit/shipparts/cabin/flicker.js): its plate a live lamp that dips a
  // little, its pool tagged FLICKER_TAG so a lab or the game can dim it with liveTick(t). Its baked light stays steady.)
  if (o.flicker) liveLamp(p, { w: len, h: wid, c: Math.min(wid / 2, 0.004), mode: 'flicker', glow: o.glow || 'white' }, at, rot);
  else add(p, o.glow || 'white', plate(shape(len, wid, Math.min(wid / 2, 0.004))), at, rot, 'glow');
  const dir = o.dir ? dirOf(rot, o.dir) : dirOf(rot, [0, 0, 1]);
  if (o.i !== 0) for (let x = -len / 2 + Math.min(0.25, len / 2); x < len / 2 + 1e-6; x += 0.5) strip(p, localAt(at, rot, [x, 0, 0.03]), o.i ?? 0.3, dir, o.reach ?? 1.6, o.color);
  if (o.pool) { pool(p, o.poolAt || localAt(at, rot, [0, 0, 0.3]), o.pool * Math.max(0.5, len), o.poolReach ?? 1.6, o.color); if (o.flicker) p.lights[p.lights.length - 1].pool.tag = FLICKER_TAG; }
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
