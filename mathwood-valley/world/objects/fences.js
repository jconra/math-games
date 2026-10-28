// THE TOWN'S FENCE STYLES AND GATES, drawn: what world/objects/fenceplan.js plans (which runs, which pieces stand, where
// the gates are), built in code from boards, posts, poles, wire and stones. The plain two-rail fence (a stroke with no
// style) is still drawn by world/valley.js exactly as it always was; this draws the styled fences and every gate.
//
// THE WOOD: every board, post, rail, picket, pole and rod reads one strip of the shared wood trim sheet (labs/materials/
// textures.js: 512 x 1024, 12 board strips with grain, knots, nails and darker bevelled edges, 2 shake strips, end-grain
// squares), drawn once in code when the first styled fence is laid (potato: drawn at half size; gaming: with its normal
// map too). Each board has its own strip, its own slide along it, a tint (lighter or darker, a little warmer or cooler)
// and a lean; a share of boards on the rustic styles are missing or broken. A lime wash (the white picket) is laid over
// the wood in the shader, thinner on the dark grain and the bevels so the wood shows through where it wore; the foot
// of everything darkens with mud and damp over its bottom 40 cm (each corner knows its height above the ground).
// All the wood is ONE merged mesh (one draw, whatever the styles), the wire one more, the stone walls one more, and the
// gates' leaves one instanced draw for each kind of gate in use (they swing).
//
// THE WIRE: each strand and barb is a ribbon turned to face the camera in the shader, never narrower than about a pixel
// and a half: thinner than that, its colour fades instead (by how much of the pixel the real wire covers), so a wire
// far off is a faint steady line, not a shimmering dotted one; the barbs fade out altogether.
//
// THE STONE WALL: the Stone Lab's wall maker (labs/stone/stonewall.js) builds three 3.6 m lengths of dry-stacked field
// wall once (about 1,800 triangles a length); the walls are laid from copies of them, stretched to fit and tilted with
// the slope. Its stone picture is the Stone Lab's own (labs/stone/stonetex.js, 256 x 256).
//
//   new Fences({ scene, heightAt, shade, tier, shadows, onReady })
//     shade(material): the page's own shading added to a material (the valley's landShaded: the hill's shadow, the lamps)
//     onReady(what): something loaded late ('wood': the trim sheet drawn, 'stone': the wall maker in): lay them again
//   fences.build(plan, plain) -> rails   the plan's styled fences and gates drawn, and the plain fence's posts and rails
//                                 as valley.js lays them (plain: { posts, rails }; the old ones thrown away); rails: the lines
//                                 they block walkers along, [[x, y, z], [x, y, z], height, half width]
//   fences.update(dt, near, camera, renderer)   each frame: gates swing open for anything near (near: [{ x, z }])
//   fences.sample(style, { len, gate }) -> { tris, draws }   a straight run on flat ground, counted (the rigs' numbers)
//   fences.icon(style, renderer, w, h) -> data URL   a small picture of a style (the Town Lab's picker)
//   fences.info -> { tris, draws, bytes }   what is drawn now, and the texture memory this added
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FENCE_STYLES, GATES, PLAIN, styleInfo, fenceLines, wormCorners, WORM } from './fenceplan.js';

const REP = 1.2;                                  // (m of board to one width of the trim sheet)
// the trim sheet's rows: 12 board strips of 64 px, then two shake strips of 32 px (rows 896, 928); v runs up the sheet
const ROWS = [...Array.from({ length: 12 }, (_, s) => [s * 64, 64]), [896, 32], [928, 32]];
const stripV = (s) => { const [r0, n] = ROWS[s]; return [1 - (r0 + n - 0.5) / 1024, 1 - (r0 + 0.5) / 1024]; };
const bandV = (s) => { const [a, b] = stripV(s), m = (a + b) / 2, h = (b - a) * 0.16; return [m - h, m + h]; };   // (a board's edge: a thin band down the strip's middle)
const BOARD_END = (j) => { const x = (j % 8) * 64; return [x / 512 + 0.003, (x + 64) / 512 - 0.003, 0.002, 0.0605]; };
const LOG_END = (j) => { const x = (j % 4) * 128; return [x / 512 + 0.003, (x + 128) / 512 - 0.003, 0.127, 0.248]; };
const NOPAINT = [0, 0, 0, 0], ONE = [1, 1, 1];
const WHITE = [0.8, 0.79, 0.74];                  // (the lime wash, linear)
// each style's wood, laid over the sheet (which the shader first weathers toward silver-grey, woodPatch): the bare and
// split woods grey, the corral and the plain fence a little warmer (Dad's rustic planks), peeled lodgepole bleached,
// log rails browner, willow rods greener
const WOODS = {
  picketWhite: [1, 0.99, 0.97], picket: [1.0, 0.99, 0.97], corral: [1.04, 0.98, 0.9], corralPost: [0.93, 0.89, 0.85], worm: [0.99, 0.98, 0.96],
  buck: [1.12, 1.09, 1.03], wire: [0.95, 0.95, 0.94], logRail: [0.93, 0.87, 0.8], wattle: [0.94, 0.92, 0.74], wattleStake: [0.8, 0.75, 0.69],
  plain: [1.0, 0.95, 0.88], gatePost: [0.94, 0.9, 0.86],
};
// the barbed wire: a strand's half width (m), a barb every `barb` m along it from `first` (the shader marks them too)
const WIRE = { half: 0.0024, barb: 0.32, first: 0.16 };

// ── little vector sums on [x, y, z] ───────────────────────────────────────────────────────────────────────────────────
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
const neg = (a) => [-a[0], -a[1], -a[2]];
const UP = [0, 1, 0];
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a board's own colour: lighter or darker by one number (one each would change its hue), a little warmer or cooler
const tintOf = (R, base = ONE, light = 0.13, hue = 0.04) => { const l = 1 + (R() * 2 - 1) * light, h = (R() * 2 - 1) * hue; return [base[0] * l * (1 + h), base[1] * l, base[2] * l * (1 - h)]; };
// an upright leaning a little: up tipped by a and b radians toward D and N
const leanUp = (D, N, a, b) => norm(add(add(UP, D, a), N, b));

// ── the wood's mesh, built up a face at a time ────────────────────────────────────────────────────────────────────────
class Acc {
  constructor() { this.P = []; this.N = []; this.T = []; this.C = []; this.K = []; this.I = []; this.n = 0; }
  get tris() { return this.I.length / 3; }
  vert(p, n, u, v, c, k) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.T.push(u, v); this.C.push(c[0], c[1], c[2]); this.K.push(k[0], k[1], k[2], k[3]); return this.n++; }
  // a flat face: its corners in order round it (3 or more, convex), its outward normal, each corner's uv; wound to face out
  face(ps, n, uvs, c, k) {
    const f = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])), o = ps.map((_, i) => i); if (dot(f, n) < 0) o.reverse();
    const ids = o.map((i) => this.vert(ps[i], n, uvs[i][0], uvs[i][1], c, k));
    for (let i = 1; i < ids.length - 1; i++) this.I.push(ids[0], ids[i], ids[i + 1]);
  }
  // a box: middle o, its own square axes X (the grain), Y, Z, half sizes. f: strip, u0 (slide along the strip), tint,
  // paint ([r, g, b, cover]), end (which end-grain square), skip ('+x-y...': faces nobody sees)
  box(o, X, Y, Z, hx, hy, hz, f = {}) {
    const c = (sx, sy, sz) => [o[0] + X[0] * sx * hx + Y[0] * sy * hy + Z[0] * sz * hz, o[1] + X[1] * sx * hx + Y[1] * sy * hy + Z[1] * sz * hz, o[2] + X[2] * sx * hx + Y[2] * sy * hy + Z[2] * sz * hz];
    const s = f.strip ?? 0, [vb, vt] = stripV(s), [eb, et] = bandV(s), u0 = f.u0 || 0, tint = f.tint || ONE, k = f.paint || NOPAINT, skip = f.skip || '';
    const U = (sx) => u0 + (sx + 1) * hx / (REP * (f.stretch || 1)), V = (sy) => vb + (vt - vb) * (sy + 1) / 2, E = (sz) => eb + (et - eb) * (sz + 1) / 2;
    const [a0, a1, b0, b1] = BOARD_END(f.end ?? 0), EU = (sz) => a0 + (a1 - a0) * (sz + 1) / 2, EV = (sy) => b0 + (b1 - b0) * (sy + 1) / 2;
    if (!skip.includes('+z')) this.face([c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1)], Z, [[U(-1), V(-1)], [U(1), V(-1)], [U(1), V(1)], [U(-1), V(1)]], tint, k);
    if (!skip.includes('-z')) this.face([c(1, -1, -1), c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1)], neg(Z), [[U(1), V(1)], [U(-1), V(1)], [U(-1), V(-1)], [U(1), V(-1)]], tint, k);
    if (!skip.includes('+y')) this.face([c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1), c(-1, 1, -1)], Y, [[U(-1), E(1)], [U(1), E(1)], [U(1), E(-1)], [U(-1), E(-1)]], tint, k);
    if (!skip.includes('-y')) this.face([c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1)], neg(Y), [[U(-1), E(-1)], [U(1), E(-1)], [U(1), E(1)], [U(-1), E(1)]], tint, k);
    if (!skip.includes('+x')) this.face([c(1, -1, 1), c(1, -1, -1), c(1, 1, -1), c(1, 1, 1)], X, [[EU(1), EV(-1)], [EU(-1), EV(-1)], [EU(-1), EV(1)], [EU(1), EV(1)]], tint, k);
    if (!skip.includes('-x')) this.face([c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1)], neg(X), [[EU(-1), EV(-1)], [EU(1), EV(-1)], [EU(1), EV(1)], [EU(-1), EV(1)]], tint, k);
  }
  // a board from p to q (its middle line), hw half its width (along Y, square to the board and to N), ht half its
  // thickness (along N, the way its face looks)
  board(p, q, hw, ht, N, f = {}) {
    const X = norm(sub(q, p)), Z = norm(sub(N, scl(X, dot(N, X)))), Y = cross(Z, X), L = Math.hypot(...sub(q, p));
    this.box(scl(add(p, q), 0.5), X, Y, Z, L / 2, hw, ht, f);
  }
  // a flat cut board (a picket): its outline in its own (g: along the grain, X; c: across it, Y) metres, from o,
  // ht half its thickness along Z. f.open: edges (by their first corner's index) left without a side
  slab(o, X, Y, Z, poly, ht, f = {}) {
    const P = (g, c, sz) => [o[0] + X[0] * g + Y[0] * c + Z[0] * sz * ht, o[1] + X[1] * g + Y[1] * c + Z[1] * sz * ht, o[2] + X[2] * g + Y[2] * c + Z[2] * sz * ht];
    const s = f.strip ?? 0, [vb, vt] = stripV(s), [eb, et] = bandV(s), u0 = f.u0 || 0, tint = f.tint || ONE, k = f.paint || NOPAINT;
    let c0 = Infinity, c1 = -Infinity, gm = 0, cm = 0; for (const [g, c] of poly) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); gm += g / poly.length; cm += c / poly.length; }
    const rep = REP * (f.stretch || 1), uv = ([g, c]) => [u0 + g / rep, vb + (vt - vb) * (c - c0) / (c1 - c0 || 1)];
    this.face(poly.map(([g, c]) => P(g, c, 1)), Z, poly.map(uv), tint, k);
    this.face(poly.map(([g, c]) => P(g, c, -1)), neg(Z), poly.map(uv), tint, k);
    poly.forEach((a, i) => {
      if (f.open && f.open.includes(i)) return;
      const b = poly[(i + 1) % poly.length], eg = b[0] - a[0], ec = b[1] - a[1];
      let ng = ec, nc = -eg; if (ng * ((a[0] + b[0]) / 2 - gm) + nc * ((a[1] + b[1]) / 2 - cm) < 0) { ng = -ng; nc = -nc; }
      const n = norm(add(scl(X, ng), Y, nc)), u = (p) => u0 + (p[0] + p[1] * 0.5) / rep;
      this.face([P(a[0], a[1], 1), P(b[0], b[1], 1), P(b[0], b[1], -1), P(a[0], a[1], -1)], n, [[u(a), et], [u(b), et], [u(b), eb], [u(a), eb]], tint, k);
    });
  }
  // a pole from a to b: sides faces round it, r (or [r at a, r at b]); f.round: smooth (a log), else faceted (a split
  // rail: every face its own full strip, so the bevels mark each arris); f.jit: how uneven its sides; f.roll: turned
  // about its length; f.caps: 'log' | 'board' | false (its ends)
  pole(a, b, r, sides, f = {}, R = Math.random) {
    const X = norm(sub(b, a)), L = Math.hypot(...sub(b, a)), hint = Math.abs(X[1]) > 0.9 ? (f.side || [1, 0, 0]) : UP;
    const Y = norm(sub(hint, scl(X, dot(hint, X)))), Z = cross(X, Y), [r0, r1] = Array.isArray(r) ? r : [r, r];
    const s = f.strip ?? 0, [vb, vt] = stripV(s), u0 = f.u0 || 0, tint = f.tint || ONE, k = f.paint || NOPAINT, roll = f.roll ?? -Math.PI / 2, ul = L / (REP * (f.stretch || 1));
    const jit = Array.from({ length: sides }, () => 1 + ((R() * 2) - 1) * (f.jit || 0));
    const dirs = Array.from({ length: sides + 1 }, (_, i) => { const t = roll + i / sides * Math.PI * 2; return add(scl(Y, Math.cos(t)), Z, Math.sin(t)); });
    const at = (i, end) => add(end ? b : a, dirs[i], (end ? r1 : r0) * jit[i % sides]);
    if (f.round) {
      const ia = [], ib = [];
      for (let i = 0; i <= sides; i++) { const v = vb + (vt - vb) * i / sides; ia.push(this.vert(at(i, 0), dirs[i], u0, v, tint, k)); ib.push(this.vert(at(i, 1), dirs[i], u0 + ul, v, tint, k)); }
      for (let i = 0; i < sides; i++) this.I.push(ia[i], ia[i + 1], ib[i + 1], ia[i], ib[i + 1], ib[i]);
    } else {
      for (let i = 0; i < sides; i++) {
        const n = norm(add(dirs[i], dirs[i + 1]));
        this.face([at(i, 0), at(i + 1, 0), at(i + 1, 1), at(i, 1)], n, [[u0, vb], [u0, vt], [u0 + ul, vt], [u0 + ul, vb]], tint, k);
      }
    }
    if (f.caps) for (const end of [0, 1]) {
      if (f.caps === 'top' && !end) continue;
      const [a0, a1, b0, b1] = f.caps === 'board' ? BOARD_END(f.end ?? 0) : LOG_END(f.end ?? 0), cu = (a0 + a1) / 2, cv = (b0 + b1) / 2;
      const ps = [], uvs = []; for (let i = 0; i < sides; i++) { ps.push(at(i, end)); const t = roll + i / sides * Math.PI * 2; uvs.push([cu + Math.cos(t) * (a1 - a0) * 0.45 * jit[i], cv + Math.sin(t) * (b1 - b0) * 0.45 * jit[i]]); }
      this.face(ps, end ? X : neg(X), uvs, tint, k);
    }
  }
  geometry(footOf) {
    const g = new THREE.BufferGeometry(), foot = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) foot[i] = footOf(this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.T, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(this.K, 4));
    g.setAttribute('aFoot', new THREE.BufferAttribute(foot, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    return g;
  }
}
// the wire: ribbons along each strand and barb, their middle line only (the shader turns them to the camera)
class WireAcc {
  constructor() { this.P = []; this.D = []; this.S = []; this.H = []; this.A = []; this.I = []; this.n = 0; }
  get tris() { return this.I.length / 3; }
  seg(p, q, half, along = 0) {
    const d = norm(sub(q, p)), L = Math.hypot(...sub(q, p)), i = this.n;
    for (const [pt, sd, al] of [[p, -1, along], [p, 1, along], [q, 1, along + L], [q, -1, along + L]]) { this.P.push(...pt); this.D.push(...d); this.S.push(sd); this.H.push(half); this.A.push(al); }
    this.n += 4; this.I.push(i, i + 1, i + 2, i, i + 2, i + 3);
    return along + L;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(this.D, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(this.S, 1));
    g.setAttribute('aHalf', new THREE.Float32BufferAttribute(this.H, 1));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(this.A, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius += 0.5;
    return g;
  }
}

// ── along a piece of fence ────────────────────────────────────────────────────────────────────────────────────────────
// spots along its line: one at every corner and evenly between, no more than `every` apart; each with the way the line
// runs there (D, along it; N, square to it, flat) and how far along it is
function spots(pts, every) {
  const out = []; let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-6) continue;
    const n = Math.max(1, Math.ceil(L / every - 0.2)), D = [(bx - ax) / L, 0, (bz - az) / L];
    for (let i = out.length ? 1 : 0; i <= n; i++) out.push({ x: ax + (bx - ax) * i / n, z: az + (bz - az) * i / n, D, N: [-D[2], 0, D[0]], s: s + L * i / n });
    s += L;
  }
  // (a corner's way: halfway between its two runs)
  for (let i = 1; i < out.length - 1; i++) if (out[i].D !== out[i + 1].D && out[i + 1].s - out[i].s > 1e-6) { const D = norm(add(out[i].D, out[i + 1].D)); out[i] = { ...out[i], D, N: [-D[2], 0, D[0]], corner: true }; }
  return out;
}
// the bays between them: from one spot to the next, with both ends' ground
const bays = (sp, ground) => sp.slice(1).map((b, i) => { const a = sp[i], L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6, D = [(b.x - a.x) / L, 0, (b.z - a.z) / L];
  return { a, b, L, D, N: [-D[2], 0, D[0]], ga: ground(a.x, a.z), gb: ground(b.x, b.z), i }; });
const P3 = (x, y, z) => [x, y, z];

// ── the styles ────────────────────────────────────────────────────────────────────────────────────────────────────────
// each: (B, piece, run, R) with B = { wood, wire, ground, stoneAt }; the piece's line in piece.pts, run.size its height
// against the style's own; R its random numbers (from the stroke's seed, so a fence always comes back the same)
function squarePost(B, x, z, w, top, D, R, f = {}) {
  const g = B.ground(x, z), N = [-D[2], 0, D[0]], X = leanUp(D, N, (R() - 0.5) * 0.03, (R() - 0.5) * 0.03), Y = norm(sub(D, scl(X, dot(D, X)))), Z = cross(X, Y);
  const y0 = g - 0.12, h = top + 0.12 + (R() - 0.5) * 0.03, paint = f.paint, tint = tintOf(R, f.tint || [1.0, 0.98, 0.96]);
  B.wood.box(add([x, y0, z], X, h / 2), X, Y, Z, h / 2, w / 2, w / 2, { strip: f.strip ?? Math.floor(R() * 12), u0: R() * 3, stretch: 1.5, tint, paint, end: Math.floor(R() * 8), skip: '-x' });
  if (f.cap) B.wood.box(add([x, y0, z], X, h + 0.016), X, Y, Z, 0.016, w / 2 + 0.025, w / 2 + 0.025, { strip: f.strip ?? Math.floor(R() * 12), u0: R() * 3, tint, paint, end: Math.floor(R() * 8), skip: '-x' });   // (a cap board)
}
// a round log or pole from a to b: a board strip, the grain drawn out 4 to 6 times along it (the rings only
// on its cut ends), its own turn and slide, 10 to 15% thinner at one end (either end, unless keepEnds)
function log(A, a, b, r, R, tint, o = {}) {
  if (!o.keepEnds && R() < 0.5) [a, b] = [b, a];
  A.pole(a, b, [r * 1.03, r * (0.85 + 0.05 * R())], o.sides || 7, { round: true, jit: o.jit ?? 0.08, roll: -Math.PI / 2 + (R() - 0.5) * 1.4, strip: Math.floor(R() * 12), u0: R() * 6, stretch: 4 + 2 * R(), tint, caps: o.caps ?? 'log', end: Math.floor(R() * 4), side: o.side }, R);   // (a board strip drawn out 4 to 6 times: its knots and cracks become long checks)
}
function roundPost(B, x, z, r, top, D, R, f = {}) {
  const g = B.ground(x, z), N = [-D[2], 0, D[0]], X = leanUp(D, N, (R() - 0.5) * 0.04, (R() - 0.5) * 0.04);
  log(B.wood, [x, g - 0.12, z], add([x, g - 0.12, z], X, top + 0.12 + (R() - 0.5) * 0.05), r, R, tintOf(R, f.tint || [0.98, 0.96, 0.94]), { sides: f.sides || 7, caps: 'top', side: D, keepEnds: true, jit: 0.1 });
}
const whiteOf = (R, lo = 0.5, hi = 0.95) => [...WHITE, lo + (hi - lo) * R()];

const STYLE_BUILD = {
  // THE PICKET FENCE (white: pointed pickets, lime-washed; bare: dog-eared, the odd one missing or broken): square posts
  // every 2.4 m, two stringers on their face, the pickets nailed to those, 13.5 cm apart
  picketWhite: (B, pc, run, R) => picket(B, pc, run, R, true),
  picket: (B, pc, run, R) => picket(B, pc, run, R, false),
  // THE HORSE CORRAL: square posts every 2.45 m, four wide sawn boards on the inside face, a board missing here and there,
  // another split and hanging from one nail
  corral(B, pc, run, R) {
    const S = run.size, H = 1.5 * S, sp = spots(pc.pts, 2.45), post = 0.15, off = post / 2 + 0.018;
    sp.forEach((p, i) => { if ((i === 0 && pc.gateA) || (i === sp.length - 1 && pc.gateB)) return; squarePost(B, p.x, p.z, post, H + 0.06, p.D, R, { tint: WOODS.corralPost }); });
    for (const b of bays(sp, B.ground)) for (const yc of [1.41, 1.03, 0.65, 0.27].map((y) => y * S)) {
      const r = R(); if (r < 0.025) continue;                             // (a board gone)
      const ya = b.ga + yc + (R() - 0.5) * 0.02, yb = b.gb + yc + (R() - 0.5) * 0.02, f = { strip: Math.floor(R() * 12), u0: R() * 3, stretch: 1.7, tint: tintOf(R, WOODS.corral, 0.15), end: Math.floor(R() * 8) };
      const p = P3(b.a.x + b.N[0] * off, ya, b.a.z + b.N[2] * off), q = P3(b.b.x + b.N[0] * off, yb, b.b.z + b.N[2] * off);
      if (r < 0.045 && b.L > 1.2) {                                       // (split: hanging from the nail at one end)
        const keep = 0.45 + 0.3 * R(), drop = 0.25 + 0.3 * R(), dir = norm(sub(q, p)), L = b.L * keep, end = add(add(p, dir, L * Math.cos(drop)), UP, -L * Math.sin(drop));
        B.wood.board(p, end, 0.075, 0.0175, b.N, f); continue;
      }
      B.wood.board(p, q, 0.075, 0.0175, b.N, f);
    }
  },
  // THE ZIGZAG (worm) FENCE: split rails laid panel to panel, each panel swung about 28 degrees off the run, the corners
  // 0.7 m either side of it (fenceplan.js WORM); at each corner the two panels' rails cross, stacked turn about, the one
  // on top swapping layer by layer, so no posts are needed. A rail is a split wedge: three uneven sides, its grain long
  worm(B, pc, run, R) {
    const S = run.size, H = 1.35 * S, C = wormCorners(pc.pts, WORM.panel, WORM.amp), n = Math.max(3, Math.round(7 * Math.min(1.2, S))), dy = (H - 0.1) / (n + 0.5);
    for (let i = 0; i < C.length - 1; i++) {
      const [ax, az] = C[i], [bx, bz] = C[i + 1], L = Math.hypot(bx - ax, bz - az), D = [(bx - ax) / L, 0, (bz - az) / L], ga = B.ground(ax, az), gb = B.ground(bx, bz);
      const oa = i === 0 ? 0.08 : 0.32, ob = i === C.length - 2 ? 0.08 : 0.32;
      for (let k = 0; k < n; k++) {
        const y = 0.1 + k * dy + (i % 2 ? dy * 0.5 : 0), r = 0.075 + R() * 0.025;
        if (y > H) continue;
        B.wood.pole(P3(ax - D[0] * oa, ga + y + (R() - 0.5) * 0.025, az - D[2] * oa), P3(bx + D[0] * ob, gb + y + (R() - 0.5) * 0.025, bz + D[2] * ob), [r, r * (0.85 + 0.15 * R())], 3,
          { jit: 0.3, roll: R() * 6.28, strip: 12 + (R() < 0.5 ? 1 : 0), u0: R() * 6, stretch: 2.5, tint: tintOf(R, WOODS.worm, 0.16), caps: 'board', end: Math.floor(R() * 8) }, R);
      }
    }
  },
  // BUCK AND RAIL: X-bucks of peeled poles every 3 m (legs spread 1.2 m across, crossed just under the top), three rails on
  // one side's legs and one laid in the crotch on top
  buck(B, pc, run, R) {
    const S = run.size, H = 1.3 * S, Hc = H - 0.1, foot = 0.6 * Math.max(0.7, S), sp = spots(pc.pts, 3.0);
    const lodge = (a, b, r, keepEnds = false) => log(B.wood, a, b, r, R, tintOf(R, WOODS.buck, 0.12), { sides: 6, keepEnds });
    sp.forEach((p) => {
      const g = B.ground(p.x, p.z), c = [p.x, g + Hc, p.z];
      for (const side of [1, -1]) {                                       // (the two legs, one a little ahead of the other where they cross)
        const along = side * 0.07, base = [p.x + p.N[0] * foot * side + p.D[0] * along, g - 0.06, p.z + p.N[2] * foot * side + p.D[2] * along];
        const cc = add(c, p.D, along), dir = norm(sub(cc, base)), top = add(cc, dir, 0.34);
        lodge(base, top, 0.065, true);
      }
    });
    for (const b of bays(sp, B.ground)) {
      const ext = 0.28;
      // the top rail, in the crotch
      lodge(P3(b.a.x - b.D[0] * ext, b.ga + Hc + 0.085, b.a.z - b.D[2] * ext), P3(b.b.x + b.D[0] * ext, b.gb + Hc + 0.085, b.b.z + b.D[2] * ext), 0.058);
      // three on the outside of the +N legs (where a leg is at that height)
      for (const y of [0.3, 0.62, 0.94].map((v) => v * Hc / 1.2)) {
        const across = foot * (1 - y / Hc) + 0.065 + 0.055;
        lodge(P3(b.a.x + b.N[0] * across - b.D[0] * ext, b.ga + y, b.a.z + b.N[2] * across - b.D[2] * ext), P3(b.b.x + b.N[0] * across + b.D[0] * ext, b.gb + y, b.b.z + b.N[2] * across + b.D[2] * ext), 0.052);
      }
    }
  },
  // POST AND WIRE: round wooden posts every 4 m, three strands of barbed wire sagging a little between them, a barb every
  // 32 cm; an H-brace (a pole between the end post and the next, a twisted brace wire across) at each end
  wire(B, pc, run, R) {
    const S = run.size, H = 1.2 * S, sp = spots(pc.pts, 4.0), r = 0.065, ys = [0.95, 0.73, 0.51, 0.29].map((f) => f * H);
    sp.forEach((p, i) => { if ((i === 0 && pc.gateA) || (i === sp.length - 1 && pc.gateB)) return; const end = i === 0 || i === sp.length - 1 || p.corner; roundPost(B, p.x, p.z, end ? 0.085 : r, H + (end ? 0.12 : 0.07), p.D, R, { tint: WOODS.wire }); });
    const bs = bays(sp, B.ground);
    for (const b of bs) for (const [si, y] of ys.entries()) {
      const off = r + 0.006, sag = (0.02 + 0.025 * R()) * b.L / 4, n = 4, pts = [];
      for (let j = 0; j <= n; j++) {
        const t = j / n, x = lerp(b.a.x, b.b.x, t) + b.N[0] * off, z = lerp(b.a.z, b.b.z, t) + b.N[2] * off, yy = lerp(b.ga, b.gb, t) + y - sag * 4 * t * (1 - t) + (si === 0 || j === 0 || j === n ? 0 : (R() - 0.5) * 0.01);
        pts.push([x, yy, z]);
      }
      let along = 0; for (let j = 1; j <= n; j++) along = B.wire.seg(pts[j - 1], pts[j], WIRE.half, along);
      // the barbs: every WIRE.barb along the strand from WIRE.first (where the shader draws its barb marks too), two short
      // spikes crossing at the strand, each turned its own way about it
      let j = 1, s0 = 0;
      for (let s = WIRE.first; s < along - 0.08; s += WIRE.barb) {
        while (j < n && s > s0 + Math.hypot(...sub(pts[j], pts[j - 1]))) { s0 += Math.hypot(...sub(pts[j], pts[j - 1])); j++; }
        const Ls = Math.hypot(...sub(pts[j], pts[j - 1])), c = add(pts[j - 1], sub(pts[j], pts[j - 1]), (s - s0) / Ls), a = R() * Math.PI;
        for (const da of [0, Math.PI / 2]) { const e = add(scl(b.N, Math.cos(a + da)), UP, Math.sin(a + da)); B.wire.seg(add(c, e, -0.022), add(c, e, 0.022), 0.0012); }
      }
    }
    // the H-braces at both ends (a gate's end too: its post takes the strain)
    const brace = (p0, p1) => {
      const g0 = B.ground(p0.x, p0.z), g1 = B.ground(p1.x, p1.z), y = 0.85 * S, L = Math.hypot(p1.x - p0.x, p1.z - p0.z); if (L < 1.5) return;
      const D = [(p1.x - p0.x) / L, 0, (p1.z - p0.z) / L], q0 = P3(p0.x + D[0] * 0.07, g0 + y, p0.z + D[2] * 0.07), q1 = P3(p1.x - D[0] * 0.07, g1 + y, p1.z - D[2] * 0.07);
      log(B.wood, q0, q1, 0.05, R, tintOf(R, WOODS.wire), { sides: 6 });
      const N = [-D[2], 0, D[0]], w0 = P3(p0.x + N[0] * 0.08, g0 + 0.15, p0.z + N[2] * 0.08), w1 = P3(p1.x + N[0] * 0.08, g1 + y + 0.05, p1.z + N[2] * 0.08);
      B.wire.seg(w0, w1, 0.003); B.wire.seg(add(w0, D, 0.03), add(w1, D, -0.03), 0.003);
    };
    if (sp.length > 1) { brace(sp[0], sp[1]); brace(sp[sp.length - 1], sp[sp.length - 2]); }
  },
  // THE LOW STONE WALL: lengths of the Stone Lab's dry-stacked field wall laid end to end along the line, top stones on
  // edge; tilted with a gentle slope, stepped down a steep one
  stone(B, pc, run, R) {
    if (!B.stone) return;                                                 // (the wall maker isn't in yet: laid when it is)
    const S = run.size, pts = pc.pts;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
      const D = [(bx - ax) / L, 0, (bz - az) / L];
      // (at a corner each length runs on past it by half the wall's width, so the corner is closed)
      const turn = (i) => { if (i <= 0 || i >= pts.length - 1) return 0; const p = pts[i - 1], q = pts[i], r = pts[i + 1], d1 = norm([q[0] - p[0], 0, q[1] - p[1]]), d2 = norm([r[0] - q[0], 0, r[1] - q[1]]); return Math.min(0.45, 0.3 * Math.tan(Math.acos(Math.max(-1, Math.min(1, dot(d1, d2)))) / 2)); };
      const e0 = turn(k), e1 = turn(k + 1), grade = Math.abs(B.ground(bx, bz) - B.ground(ax, az)) / L;
      // on steep ground (over 1 in 10) the wall steps: level lengths short enough that each drops no more than half a metre
      const step = grade > 0.1 && grade < 0.55, n = step ? Math.max(1, Math.ceil(L / Math.min(B.stone.stepLen, 0.5 / grade))) : Math.max(1, Math.round(L / B.stone.len));
      for (let i = 0; i < n; i++) {
        const s0 = L * i / n - (i === 0 ? e0 : 0), s1 = L * (i + 1) / n + (i === n - 1 ? e1 : 0);
        (step ? B.stepAt : B.stoneAt)(R, [ax + D[0] * s0, az + D[2] * s0], [ax + D[0] * s1, az + D[2] * s1], S);
      }
    }
  },
  // THE LOG RAIL FENCE: rough round posts every 2.9 m, three log rails laid alongside them, on alternate sides bay to bay
  logRail(B, pc, run, R) {
    const S = run.size, H = 1.25 * S, sp = spots(pc.pts, 2.9), tint = WOODS.logRail;
    sp.forEach((p, i) => { if ((i === 0 && pc.gateA) || (i === sp.length - 1 && pc.gateB)) return; roundPost(B, p.x, p.z, 0.11, H + 0.12, p.D, R, { tint, sides: 7 }); });
    for (const b of bays(sp, B.ground)) {
      const side = b.i % 2 ? 1 : -1, across = side * (0.11 + 0.08), ext = 0.24;
      for (const y of [1.12, 0.74, 0.36].map((v) => v * S)) {
        if (R() < 0.02) continue;
        log(B.wood, P3(b.a.x + b.N[0] * across - b.D[0] * ext, b.ga + y + (R() - 0.5) * 0.04, b.a.z + b.N[2] * across - b.D[2] * ext),
          P3(b.b.x + b.N[0] * across + b.D[0] * ext, b.gb + y + (R() - 0.5) * 0.04, b.b.z + b.N[2] * across + b.D[2] * ext), 0.075 + R() * 0.02, R, tintOf(R, tint, 0.14), { jit: 0.12 });
      }
    }
  },
  // WATTLE: thin stakes every 42 cm, willow rods woven in and out of them, row on row
  wattle(B, pc, run, R) {
    const S = run.size, H = 0.85 * S, pts = pc.pts, cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1], n = Math.max(2, Math.round(len / 0.42)), at = (s) => { let k = 0; while (k < pts.length - 2 && cum[k + 1] < s) k++; const L = cum[k + 1] - cum[k] || 1e-6, t = (s - cum[k]) / L, D = [(pts[k + 1][0] - pts[k][0]) / L, 0, (pts[k + 1][1] - pts[k][1]) / L]; return { x: pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, z: pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t, D, N: [-D[2], 0, D[0]] }; };
    const st = []; for (let j = 0; j <= n; j++) { const p = at(len * j / n); p.g = B.ground(p.x, p.z); st.push(p); }
    for (const p of st) log(B.wood, [p.x, p.g - 0.1, p.z], add([p.x, p.g - 0.1, p.z], leanUp(p.D, p.N, (R() - 0.5) * 0.06, (R() - 0.5) * 0.06), H + 0.16 + R() * 0.06), 0.023, R, tintOf(R, WOODS.wattleStake), { sides: 5, caps: 'top', keepEnds: true, jit: 0.15 });
    const rows = Math.max(4, Math.round((H - 0.1) / 0.058));
    for (let row = 0; row < rows; row++) {
      const y = 0.08 + row * (H - 0.1) / rows, tint = tintOf(R, WOODS.wattle, 0.18, 0.08), strip = 12 + (row % 2), k = NOPAINT, hw = 0.022;
      const [vb, vt] = stripV(strip); let u = R() * 3;
      for (let j = 0; j < st.length - 1; j++) {
        const a = st[j], b = st[j + 1], oa = ((j + row) % 2 ? 1 : -1) * 0.034, ob = -oa;
        const pa = [a.x + a.N[0] * oa, a.g + y, a.z + a.N[2] * oa], pb = [b.x + b.N[0] * ob, b.g + y, b.z + b.N[2] * ob], L = Math.hypot(...sub(pb, pa)), du = L / REP;
        const N = a.N;   // (a rod's two faces: out and in)
        for (const sd of [1, -1]) {
          const o = scl(N, sd * 0.009), c = [add(add(pa, o), UP, -hw), add(add(pb, o), UP, -hw), add(add(pb, o), UP, hw), add(add(pa, o), UP, hw)];
          B.wood.face(c, scl(N, sd), [[u, vb], [u + du, vb], [u + du, vt], [u, vt]], tint, k);
        }
        u += du;
      }
    }
  },
};
// THE PLAIN FENCE (a stroke with no style): valley.js works out its posts and rails exactly as it always has; they are
// drawn here as boards of the trim sheet, each its own strip, slide and shade, the same size, turn and height as before
// (plain: { posts: [[x, y, z], height], rails: [[x, y, z], [x, y, z], height] })
function plainFence(B, plain) {
  const H = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };   // (valley.js's hash: the old posts' turns and shades)
  for (const [p, h] of plain.posts) {
    const r = H(p[0] * 1.7, p[2] * 2.3), R = rng(Math.floor(r * 1e9) + 1), yaw = r * 6.28, Y = [Math.cos(yaw), 0, -Math.sin(yaw)], Z = cross(UP, Y), tall = h + 0.08 + r * 0.1;
    B.wood.box([p[0], p[1] - 0.08 + tall / 2, p[2]], UP, Y, Z, tall / 2, 0.07, 0.07, { strip: Math.floor(R() * 12), u0: R() * 3, stretch: 1.5, tint: tintOf(R, scl(WOODS.plain, 0.82 + 0.3 * r), 0.05), end: Math.floor(R() * 8), skip: '-x' });
  }
  for (const [p, q, h] of plain.rails) {
    const D = norm([q[0] - p[0], 0, q[2] - p[2]]), N = [-D[2], 0, D[0]];
    [0.42, 0.82].forEach((f, k) => { const c = H(p[0] + k, p[2]), R = rng(Math.floor(c * 1e9) + 7);
      B.wood.board([p[0], p[1] + h * f, p[2]], [q[0], q[1] + h * f, q[2]], 0.04, 0.03, N, { strip: Math.floor(R() * 12), u0: R() * 3, stretch: 1.7, tint: tintOf(R, scl(WOODS.plain, 0.86 + 0.28 * c), 0.05), end: Math.floor(R() * 8) }); });
  }
}
function picket(B, pc, run, R, white) {
  const S = run.size, H = 0.95 * S, sp = spots(pc.pts, 2.4), post = 0.085, offS = post / 2 + 0.022, offP = post / 2 + 0.044 + 0.011;
  const wood = white ? WOODS.picketWhite : WOODS.picket, shake = () => (R() < 0.5 ? 12 : 13);
  sp.forEach((p, i) => {
    if ((i === 0 && pc.gateA) || (i === sp.length - 1 && pc.gateB)) return;
    const big = i === 0 || i === sp.length - 1 || p.corner;   // (a corner or an end: a stouter post with a cap)
    squarePost(B, p.x, p.z, big ? 0.11 : post, H + (big ? 0.12 : 0.07), p.D, R, { paint: white ? whiteOf(R, 0.8, 1) : null, tint: wood, strip: white ? shake() : undefined, cap: big });
  });
  for (const b of bays(sp, B.ground)) {
    for (const y of [0.22 * S, H - 0.2 * S]) B.wood.board(P3(b.a.x + b.N[0] * offS, b.ga + y, b.a.z + b.N[2] * offS), P3(b.b.x + b.N[0] * offS, b.gb + y, b.b.z + b.N[2] * offS), 0.042, 0.022, b.N,
      { strip: white ? shake() : Math.floor(R() * 12), u0: R() * 3, stretch: 1.5, tint: tintOf(R, wood), paint: white ? whiteOf(R, 0.75, 1) : null, end: Math.floor(R() * 8) });
    const n = Math.max(1, Math.round(b.L / 0.135));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = lerp(b.a.x, b.b.x, t), z = lerp(b.a.z, b.b.z, t), line = lerp(b.ga, b.gb, t), r = R();
      if (!white && r < 0.025) continue;                                   // (one gone)
      const base = Math.min(line, B.ground(x, z)) - 0.05, top = line + H + (R() - 0.5) * 0.025, h = top - base, w = 0.075, hw = w / 2;
      const X = leanUp(b.D, b.N, (R() - 0.5) * 0.035, (R() - 0.5) * 0.025), Y = norm(sub(b.D, scl(X, dot(b.D, X)))), Z = cross(X, Y);
      let poly;
      if (!white && r < 0.055) { const h1 = h - 0.18 - R() * 0.3, h2 = h1 + (R() - 0.5) * 0.12; poly = [[0, -hw], [0, hw], [h1, hw], [(h1 + h2) / 2 + 0.03, 0.005], [h2, -hw]]; }   // (broken off)
      else poly = white ? [[0, -hw], [0, hw], [h - 0.07, hw], [h, 0], [h - 0.07, -hw]] : [[0, -hw], [0, hw], [h - 0.026, hw], [h, hw - 0.026], [h, -hw + 0.026], [h - 0.026, -hw]];
      B.wood.slab(add([x, base, z], b.N, offP), X, Y, Z, poly, 0.01, { strip: R() < 0.5 ? 12 : 13, u0: R() * 3, stretch: 1.4, tint: tintOf(R, wood, 0.14), paint: white ? whiteOf(R, 0.72, 1) : null, open: [0] });
    }
  }
}

// ── the gates: two posts fixed in the fence, and the leaf that swings ─────────────────────────────────────────────────
// each kind's leaf, made once, in its own frame: hinged at x = 0, reaching to x = w along +x, standing from y = 0
const LEAF = {
  picketWhite: { w: 0.98, h: 0.93, build: (A, R) => picketLeaf(A, R, true) },
  picket: { w: 0.98, h: 0.93, build: (A, R) => picketLeaf(A, R, false) },
  corral: { w: 3.5, h: 1.45, build: (A, R) => boardLeaf(A, R, 3.5, 1.45, 5) },
  board: { w: 3.5, h: 1.45, build: (A, R) => boardLeaf(A, R, 3.5, 1.45, 5) },
  ranch: { w: 3.5, h: 1.32, build: (A, R) => ranchLeaf(A, R, 3.5, 1.32) },
};
const LX = [1, 0, 0], LY = [0, 1, 0], LZ = [0, 0, 1];
function picketLeaf(A, R, white) {
  const w = 0.98, paint = () => (white ? whiteOf(R, 0.75, 1) : null), wood = white ? WOODS.picketWhite : WOODS.picket, strip = () => (white ? (R() < 0.5 ? 12 : 13) : Math.floor(R() * 12));
  for (const y of [0.2, 0.7]) A.board([0.02, y, -0.022], [w - 0.02, y, -0.022], 0.042, 0.02, LZ, { strip: strip(), u0: R() * 3, stretch: 1.5, tint: tintOf(R, wood), paint: paint() });
  A.board([0.06, 0.22, -0.026], [w - 0.06, 0.68, -0.026], 0.04, 0.016, LZ, { strip: strip(), u0: R() * 3, stretch: 1.5, tint: tintOf(R, wood), paint: paint() });   // (the brace)
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = 0.07 + i * (w - 0.14) / (n - 1), h = 0.93 + (R() - 0.5) * 0.02, hw = 0.0375;
    const poly = white ? [[0, -hw], [0, hw], [h - 0.07, hw], [h, 0], [h - 0.07, -hw]] : [[0, -hw], [0, hw], [h - 0.026, hw], [h, hw - 0.026], [h, -hw + 0.026], [h - 0.026, -hw]];
    A.slab([x, 0, 0.0], LY, [-1, 0, 0], LZ, poly, 0.01, { strip: R() < 0.5 ? 12 : 13, u0: R() * 3, stretch: 1.4, tint: tintOf(R, wood), paint: paint() });
  }
  for (const y of [0.2, 0.7]) A.box([0.12, y, -0.045], LX, LY, LZ, 0.12, 0.018, 0.003, { strip: 0, tint: [0.18, 0.17, 0.16] });   // (iron hinge straps)
}
function boardLeaf(A, R, w, h, n) {
  const f = () => ({ strip: Math.floor(R() * 12), u0: R() * 3, stretch: 1.7, tint: tintOf(R, WOODS.corral, 0.14), end: Math.floor(R() * 8) });
  for (const x of [0.07, w - 0.07]) A.board([x, 0, -0.035], [x, h, -0.035], 0.065, 0.022, LZ, f());   // (the stiles)
  for (let i = 0; i < n; i++) { const y = 0.12 + i * (h - 0.2) / (n - 1); A.board([0, y, 0.0], [w, y, 0.0], 0.07, 0.017, LZ, f()); }
  // the Z-brace: from the foot of the hinge side up to the top of the latch side, behind the boards
  const y0 = 0.12, y1 = 0.12 + (h - 0.2);
  A.board([0.14, y0 + 0.03, -0.034], [w - 0.14, y1 - 0.03, -0.034], 0.07, 0.017, LZ, f());
  for (const y of [y0, y1]) A.box([0.2, y, 0.03], LX, LY, LZ, 0.2, 0.025, 0.004, { strip: 0, tint: [0.16, 0.15, 0.14] });
}
function ranchLeaf(A, R, w, h) {
  const lp = (a, b, r) => log(A, a, b, r, R, tintOf(R, WOODS.buck, 0.12), { sides: 6, jit: 0.07 });
  lp([0.06, 0, 0], [0.06, h, 0], 0.06); lp([w - 0.06, 0, 0], [w - 0.06, h, 0], 0.055);
  for (const y of [0.25, 0.6, 0.95, h - 0.06]) lp([0, y, 0.05], [w, y, 0.05], 0.045);
  lp([0.08, 0.25, -0.05], [w - 0.08, h - 0.06, -0.05], 0.045);
}
const POST = {   // each gate's posts: square, round or stone; how thick (half), how tall over the fence's height
  picketWhite: { half: 0.06, extra: 0.16 }, picket: { half: 0.06, extra: 0.16 }, corral: { half: 0.11, extra: 1.35, header: 2.95 },
  board: { half: 0.13, extra: 0.25 }, ranch: { half: 0.11, extra: 0.3 },
};

// ── the stone wall's numbers, and its top stones ───────────────────────────────────────────────────────────────────────
// size: a typical stone (m); body: the stacked part's top; base, top: its width at the ground and there; len: a level
// length; stepLen, below: a step's length, and how much deeper it goes
const WALL = { size: 0.2, body: 0.6, base: 0.64, top: 0.46, len: 3.6, stepLen: 1.8, below: 0.55 };
// TOP STONES ON EDGE (a dry wall's cope): rough flat stones stood upright across the wall's top, close together, leaning a
// little one way then the other, each its own colour from the palette; made with the wall maker's own corner numbers (its
// tint against the rock picture's average, how much sky a corner sees, how far it is from the stone's edge) so they share
// its material and merge with it
function copeRow(L, y0, width, seed, pal, mean) {
  const R = rng(seed * 977 + 3), lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)), m = mean ? mean.map(lin) : [1, 1, 1];
  const P = [], N = [], T = [], K = [], A = [], M = [], I = []; let n = 0, x = -L / 2 + 0.005, i = 0;
  while (x < L / 2 - 0.04) {
    const th = Math.min(L / 2 - x - 0.004, 0.06 + 0.08 * R()), h = 0.16 + 0.1 * R(), w = width * (0.86 + 0.18 * R()), lean = (i++ % 2 ? 1 : -1) * (0.03 + 0.12 * R());
    const r = R(), c = r < 0.14 ? pal.dark : r < 0.45 ? pal.second : pal.base, l = 1 + (R() * 2 - 1) * 0.12, tint = c.map((v, k) => lin(Math.min(1, v * l)) / m[k]);
    const ou = [R() * 3, R() * 3], C = [];
    for (const sy of [0, 1]) for (const sx of [0, 1]) for (const sz of [0, 1]) { const up = sy ? h + (R() - 0.5) * 0.07 : -0.04; C.push([x + sx * th + (R() - 0.5) * 0.025 + up * lean, y0 + up, (sz - 0.5) * w * (sy ? 0.9 + 0.08 * R() : 1) + (R() - 0.5) * 0.03]); }
    const at = (sx, sy, sz) => C[sy * 4 + sx * 2 + sz], mid = C.reduce((a, p) => add(a, p, 1 / 8), [0, 0, 0]);
    for (const f of [[at(0, 0, 1), at(1, 0, 1), at(1, 1, 1), at(0, 1, 1)], [at(1, 0, 0), at(0, 0, 0), at(0, 1, 0), at(1, 1, 0)], [at(1, 0, 1), at(1, 0, 0), at(1, 1, 0), at(1, 1, 1)],
      [at(0, 0, 0), at(0, 0, 1), at(0, 1, 1), at(0, 1, 0)], [at(0, 1, 1), at(1, 1, 1), at(1, 1, 0), at(0, 1, 0)]]) {
      let q = f; const fc = q.reduce((a, p) => add(a, p, 0.25), [0, 0, 0]); let nn = norm(cross(sub(q[1], q[0]), sub(q[2], q[0])));
      if (dot(nn, sub(fc, mid)) < 0) { q = [...q].reverse(); nn = neg(nn); }
      const ax = Math.abs(nn[0]) > Math.abs(nn[1]) && Math.abs(nn[0]) > Math.abs(nn[2]) ? 0 : Math.abs(nn[1]) > Math.abs(nn[2]) ? 1 : 2;
      const ids = q.map((p) => { const uv = ax === 0 ? [p[2], p[1]] : ax === 1 ? [p[0], p[2]] : [p[0], p[1]];
        P.push(...p); N.push(...nn); T.push(uv[0] / 0.7 + ou[0], uv[1] / 0.7 + ou[1]); K.push(tint[0], tint[1], tint[2], 4); A.push(p[1] < y0 + 0.02 ? 0.78 : 1); M.push(1, 0.2); return n++; });
      I.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
    x += th + 0.004 + 0.008 * R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
  g.setAttribute('aTintPaint', new THREE.Float32BufferAttribute(K, 4)); g.setAttribute('aAO', new THREE.Float32BufferAttribute(A, 1)); g.setAttribute('aRim', new THREE.Float32BufferAttribute(M, 2));
  g.setIndex(I); return g;
}

// ── the shader patches ────────────────────────────────────────────────────────────────────────────────────────────────
function patch(m, key, fn) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); fn(sh); };
  m.customProgramCacheKey = () => prevKey() + key;
  return m;
}
// (the land's shade is read where each corner is, not at the mesh's middle: these meshes are the whole town's fences)
const landAtCorner = (vs) => vs.replace('vec4 lw = vec4(0.0, 0.0, 0.0, 1.0);', 'vec4 lw = vec4(transformed, 1.0);');
function woodPatch(m) {
  return patch(m, '+fenceWood', (sh) => {
    sh.vertexShader = landAtCorner(sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aPaint;\nattribute float aFoot;\nvarying vec4 vPaint;\nvarying float vFoot;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaint = aPaint; vFoot = aFoot;'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vPaint;\nvarying float vFoot;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      #if defined( USE_MAP ) && defined( USE_COLOR )
      { // weathered: half the sheet's colour gone toward silver-grey, its knots and swirls flattened, a little lighter
        vec3 tx = sampledDiffuseColor.rgb; float tl = dot(tx, vec3(0.3, 0.59, 0.11));
        tx = mix(vec3(tl), tx, 0.5); tx = mix(vec3(0.15), tx, 0.72) * 1.2;
        diffuseColor.rgb = vColor * tx * vec3(0.98, 1.0, 1.03); }
      #endif
      { float wl = 1.0;
      #ifdef USE_MAP
        wl = clamp(dot(sampledDiffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * 6.5, 0.0, 1.6);
      #endif
        float cover = vPaint.a * smoothstep(0.32, 0.78, wl);   // (thinner on the dark grain and the bevels: worn through there)
        diffuseColor.rgb = mix(diffuseColor.rgb, vPaint.rgb * (0.86 + 0.14 * wl), cover);
        float foot = 1.0 - smoothstep(0.0, 0.42, vFoot);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.46, 0.43, 0.34), foot * foot * 0.9 + foot * 0.1); }`);
  });
}
function wirePatch(m, U) {
  return patch(m, '+fenceWire', (sh) => {
    sh.uniforms.uPix = U.uPix;
    sh.vertexShader = landAtCorner(sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aDir;\nattribute float aSide;\nattribute float aHalf;\nattribute float aAlong;\nuniform float uPix;\nvarying float vCover;\nvarying float vAlong;\nvarying float vPx;\nvarying float vStrand;')
      .replace('#include <beginnormal_vertex>', 'vec3 wToCam = cameraPosition - position;\nvec3 objectNormal = normalize(normalize(wToCam) + vec3(0.0, 0.4, 0.0));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
      { float px = length(wToCam) * uPix; vStrand = aHalf > 0.0018 ? 1.0 : 0.0;
        float w = max(aHalf, px * (vStrand > 0.5 ? 1.0 : 0.75));
        transformed += normalize(cross(aDir, wToCam)) * aSide * w;
        vCover = aHalf / w; vAlong = aAlong; vPx = px; }`));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCover;\nvarying float vAlong;\nvarying float vPx;\nvarying float vStrand;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(1.0, 0.8 + 0.2 * sin(vAlong * 90.0), clamp(vCover * 2.0 - 0.6, 0.0, 1.0));   // (the two twisted wires, close up)
      { // the barb marks: a dark knot on the strand every ${WIRE.barb} m, never thinner than a pixel and a half, fading out far off
        float d = abs(fract((vAlong - ${WIRE.first.toFixed(3)}) / ${WIRE.barb.toFixed(3)} + 0.5) - 0.5) * ${WIRE.barb.toFixed(3)}, hw = max(0.014, vPx * 0.75);
        diffuseColor.rgb *= 1.0 - 0.55 * vStrand * (1.0 - smoothstep(hw, hw + vPx, d)) * (1.0 - smoothstep(0.045, 0.09, vPx)); }
      diffuseColor.a *= vStrand > 0.5 ? mix(0.95, 0.4, smoothstep(0.05, 0.12, vPx)) : clamp(vCover * 1.5, 0.0, 1.0);`);
  });
}
function stonePatch(m) {
  return patch(m, '+fenceStone', (sh) => {
    sh.vertexShader = landAtCorner(sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aTintPaint;\nattribute float aAO;\nvarying vec3 vTint;\nvarying float vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = aTintPaint.rgb; vAO = aAO;'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTint;\nvarying float vAO;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint * vAO;');
  });
}

// ── the fences ────────────────────────────────────────────────────────────────────────────────────────────────────────
export class Fences {
  constructor({ scene, heightAt, shade = (m) => m, tier = 'normal', shadows = false, onReady = null }) {
    Object.assign(this, { scene, heightAt, shade, tier, shadows, onReady });
    this.meshes = []; this.gates = []; this.leafGeo = {}; this.U = { uPix: { value: 0.002 } };
    this.stone = null; this.stoneLoading = null; this.info = { tris: 0, draws: 0, bytes: 0 };
    this.mats = this.materials();
  }
  // the materials, made once: their pictures drawn later (wood) or loaded (stone), painted into the same textures
  materials() {
    const small = this.tier === 'potato', W = small ? 256 : 512, H = small ? 512 : 1024;
    const canvas = (fill) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, W, H); return c; };
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = small ? 2 : 8; return t; };
    const map = tex(canvas('#70604e'), true), normalMap = this.tier === 'gaming' ? tex(canvas('#8080ff'), false) : null;
    this.woodTex = { map, normalMap, ready: false };
    this.info.bytes = W * H * 4 * 4 / 3 * (normalMap ? 2 : 1);
    const wood = woodPatch(this.shade(new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, roughness: 0.9, metalness: 0 })));
    const wire = wirePatch(this.shade(new THREE.MeshStandardMaterial({ color: 0xa3a29c, roughness: 0.5, metalness: 0.3, transparent: true, depthWrite: false })), this.U);
    // the trim sheet, drawn once (a few hundred ms on a desktop: after the fences are first laid, not before)
    this.woodReady = import('../../labs/materials/textures.js').then((T) => new Promise((done) => setTimeout(() => {
      const t0 = performance.now(), P = T.woodSheet('rustic', !!normalMap), put = (cv, px) => {
        const full = document.createElement('canvas'); full.width = T.WOOD.w; full.height = T.WOOD.h; const g = full.getContext('2d'), img = g.createImageData(T.WOOD.w, T.WOOD.h); img.data.set(px); g.putImageData(img, 0, 0);
        cv.getContext('2d').drawImage(full, 0, 0, cv.width, cv.height);
      };
      put(map.image, P.col); map.needsUpdate = true;
      if (normalMap) { put(normalMap.image, P.nrm); normalMap.needsUpdate = true; }
      this.woodTex.ready = true; this.info.woodMs = Math.round(performance.now() - t0); done(); if (this.onReady) this.onReady('wood');
    }, 0))).catch((e) => { console.error('fences: the wood picture failed', e); });
    return { wood, wire, stone: null };
  }
  // the Stone Lab's wall maker and its rock picture, loaded the first time a stone wall is laid
  loadStone() {
    if (this.stoneLoading) return this.stoneLoading;
    this.stoneLoading = Promise.all([import('../../labs/stone/stonewall.js'), this.tier === 'potato' ? null : import('../../labs/stone/stonetex.js')]).then(([SW, ST]) => {
      const t0 = performance.now(), RT = ST ? ST.makeRubbleTexture() : null;
      if (RT && this.tier !== 'gaming') { RT.normalMap.dispose(); RT.normalMap = null; }
      if (RT) this.info.bytes += 256 * 256 * 4 * 4 / 3 * (RT.normalMap ? 2 : 1);
      const rect = (W, D) => [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]], G = -0.12;
      const top = (W, D, o) => ({ x0: -W / 2 - o, x1: W / 2 + o, z0: -D / 2 - o, z1: D / 2 + o, open: { x0: 1, x1: 1, z0: 1, z1: 1 }, ov: { x0: o, x1: o, z0: o, z1: o } });
      // field stone, grey to buff (no brown: brown slabs read as timber)
      SW.PALETTES.fieldGrey = { label: 'Field grey', base: [0.6, 0.59, 0.56], second: [0.67, 0.63, 0.55], dark: [0.47, 0.465, 0.45], rust: [0.66, 0.62, 0.55] };
      // THE WALL: the Stone Lab's dry-stacked stones (found stones, each tried in the lowest dip until one sits well, small
      // ones knocked to fit, big ones low down) up to WALL.body, battered (WALL.base wide at the ground, WALL.top at the
      // top), no flat coping: a row of top stones on edge instead (copeRow). A length on the level (3.6 m, tilted with a
      // gentle slope) and a deeper one for steps on steep ground (1.8 m, 0.55 m more of it below)
      const shape = (L, below) => ({ label: 'Fence wall', make() { const y0 = G - below, b = WALL.base + (WALL.base - WALL.top) * below / (WALL.body - G);
        return { H: WALL.body, sections: [{ loop0: rect(L, b), loop1: rect(L, WALL.top), y0, y1: WALL.body }], openings: [], top: { y: WALL.body, t: 0, over: 0, rects: [] } }; } });
      SW.SHAPES.fenceWall = shape(WALL.len, 0); SW.SHAPES.fenceStep = shape(WALL.stepLen, WALL.below);
      SW.SHAPES.fencePier = { label: 'Gate pier', make() { const W = 0.6, H = 1.3, ct = 0.13;
        return { H, sections: [{ loop0: rect(W, W), loop1: rect(W * 0.86, W * 0.86), y0: G, y1: H - ct }], openings: [], top: { y: H, t: ct, over: 0.04, rects: [top(W * 0.86, W * 0.86, 0.04)] } }; } };
      const env = RT ? { texMean: RT.mean } : {}, recipe = (shape, seed, size) => ({ shape, style: 'drystack', size, seed, palette: 'fieldGrey', irregularity: 1, bulge: 0.45, colourMix: 0.55 });
      const one = (w, L, seed) => { const g = mergeGeometries([w.stone, w.mortar]); g.deleteAttribute('aDrip'); if (!L) return g; const c = copeRow(L, WALL.body - 0.025, WALL.top * 0.96, seed, SW.PALETTES.fieldGrey, RT && RT.mean); const m = mergeGeometries([g, c]); g.dispose(); c.dispose(); return m; };
      const lengths = [11, 23, 37].map((seed) => one(SW.buildStoneWall(recipe('fenceWall', seed, WALL.size), env), WALL.len, seed));
      const steps = [41, 53].map((seed) => one(SW.buildStoneWall(recipe('fenceStep', seed, WALL.size), env), WALL.stepLen, seed));
      const pier = one(SW.buildStoneWall({ ...recipe('fencePier', 5, 0.2), bulge: 0.35 }, env), 0, 0);
      const mat = SW.stoneEdges(stonePatch(this.shade(new THREE.MeshStandardMaterial({ map: RT ? RT.map : null, normalMap: RT ? RT.normalMap : null, roughness: 0.93, metalness: 0 }))));
      this.stone = { len: WALL.len, stepLen: WALL.stepLen, lengths, steps, pier, tris: lengths.map((g) => g.index.count / 3) };
      this.mats.stone = mat; this.info.stoneMs = Math.round(performance.now() - t0);
      if (this.onReady) this.onReady('stone');
    }).catch((e) => { console.error('fences: the stone wall maker failed', e); });
    return this.stoneLoading;
  }

  // ── laying them ──
  // everything a plan needs, into the accumulators (ground: the land's height; the rigs and icons use flat ground)
  lay(plan, ground, plain = null) {
    const wood = new Acc(), wire = new WireAcc(), stones = [], rails = [], gates = [];
    const stoneAt = (R, p, q, S) => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), ga = ground(p[0], p[1]), gb = ground(q[0], q[1]), gm = ground((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      const yaw = Math.atan2(-(q[1] - p[1]), q[0] - p[0]), pitch = Math.atan2(gb - ga, L), y = Math.min((ga + gb) / 2, gm) - 0.04;
      const m = new THREE.Matrix4().compose(new THREE.Vector3((p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YZX')), new THREE.Vector3(L / this.stone.len / Math.cos(pitch), S, 1));
      stones.push(this.stone.lengths[Math.floor(R() * this.stone.lengths.length)].clone().applyMatrix4(m));
    };
    // a step of wall on steep ground: level (its courses and top stones level), its top on the high end's ground, the deep
    // length's extra stones carrying it down below the low end's
    const stepAt = (R, p, q, S) => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), hi = Math.max(ground(p[0], p[1]), ground(q[0], q[1]), ground((p[0] + q[0]) / 2, (p[1] + q[1]) / 2));
      const m = new THREE.Matrix4().compose(new THREE.Vector3((p[0] + q[0]) / 2, hi - 0.05, (p[1] + q[1]) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-(q[1] - p[1]), q[0] - p[0])), new THREE.Vector3(L / this.stone.stepLen, S, 1));
      stones.push(this.stone.steps[Math.floor(R() * this.stone.steps.length)].clone().applyMatrix4(m));
    };
    const B = { wood, wire, ground, stone: this.stone, stoneAt, stepAt };
    if (plain && plain.posts.length) plainFence(B, plain);
    for (const run of plan.runs) {
      if (!run.style) continue;
      const info = FENCE_STYLES[run.style], H = info.h * run.size;
      if (run.style === 'stone' && !this.stone) this.loadStone();
      run.pieces.forEach((pc, pi) => {
        STYLE_BUILD[run.style](B, pc, run, rng(((run.stroke.seed >>> 0) || 1) + pi * 7919));
        const line = fenceLines(run.style, pc);
        for (let i = 1; i < line.length; i++) rails.push([[line[i - 1][0], ground(line[i - 1][0], line[i - 1][1]), line[i - 1][1]], [line[i][0], ground(line[i][0], line[i][1]), line[i][1]], H, info.half]);
      });
    }
    for (const G of plan.gates) gates.push(this.gate(B, G, ground));
    for (const m of B.stonePiers || []) stones.push(this.stone.pier.clone().applyMatrix4(m));   // (a stone wall's gate: stone piers)
    return { wood, wire, stones, rails, gates };
  }
  // a gate's two posts (into the wood, or stone piers), and where its leaf hangs
  gate(B, G, ground) {
    const R = rng(((G.run.stroke.seed >>> 0) || 1) ^ 0x5bd1e995 ^ Math.round(G.s * 100)), kind = G.kind, P = POST[kind], H = styleInfo(G.run.style).h * G.run.size;
    const [ax, az] = G.A, [bx, bz] = G.B, L = Math.hypot(bx - ax, bz - az) || 1e-6, D = [(bx - ax) / L, 0, (bz - az) / L], N = [-D[2], 0, D[0]];
    const ga = ground(ax, az), gb = ground(bx, bz), white = kind === 'picketWhite', top = Math.max(1.0, H) + P.extra;
    const stone = kind === 'board' && G.run.style === 'stone' && this.stone;
    for (const [x, z, g] of [[ax, az, ga], [bx, bz, gb]]) {
      if (stone) { B.stonePiers = B.stonePiers || []; B.stonePiers.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g - 0.04, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-D[2], D[0])), new THREE.Vector3(1, G.run.size, 1))); continue; }
      if (kind === 'ranch') roundPost(B, x, z, P.half, top, D, R, { tint: WOODS.gatePost, sides: 8 });
      else squarePost(B, x, z, P.half * 2, P.header ? P.header + 0.12 : top, D, R, { tint: white ? WOODS.picketWhite : WOODS.gatePost, paint: white ? whiteOf(R, 0.8, 1) : null, strip: white ? (R() < 0.5 ? 12 : 13) : undefined, cap: kind === 'picketWhite' || kind === 'picket' });
    }
    if (P.header) {   // (a corral's gateway: a beam across the two tall posts)
      const y = Math.max(ga, gb) + P.header;
      B.wood.board(P3(ax - D[0] * 0.35, y, az - D[2] * 0.35), P3(bx + D[0] * 0.35, y, bz + D[2] * 0.35), 0.13, 0.1, N, { strip: Math.floor(R() * 12), u0: R() * 3, stretch: 1.7, tint: tintOf(R, WOODS.corralPost), end: Math.floor(R() * 8) });
    }
    // the leaf hangs from the post at A, its foot following the ground's slope to B (racked, as a gate is hung on a slope:
    // no gap under its downhill end); it keeps that rake as it swings
    const half = stone ? 0.3 : P.half, low = kind === 'picketWhite' || kind === 'picket' ? 0.05 : 0.1;
    const hinge = [ax + D[0] * (half + 0.02), ground(ax + D[0] * (half + 0.02), az + D[2] * (half + 0.02)) + low, az + D[2] * (half + 0.02)];
    const reachW = L - 2 * (half + 0.02) - 0.03, leaf = LEAF[kind], end = [ax + D[0] * (half + 0.02 + reachW), az + D[2] * (half + 0.02 + reachW)], rake = (ground(end[0], end[1]) + low - hinge[1]) / reachW;
    const sy = Math.max(0.6, Math.min(1.5, kind === 'picketWhite' || kind === 'picket' ? H / 0.95 : kind === 'ranch' ? H / 1.25 : kind === 'board' ? H * 0.95 / leaf.h : H / 1.5));
    return { G, kind, hinge, rake, yaw: Math.atan2(-D[2], D[0]), sx: reachW / leaf.w, sy, mid: [(ax + bx) / 2, (az + bz) / 2], D, N, reach: GATES[kind].reach, ang: 0, want: 0, dir: 1, hold: 0, dirty: true };
  }
  leafGeometry(kind) {
    if (!this.leafGeo[kind]) { const A = new Acc(); LEAF[kind].build(A, rng(4242 + kind.length)); this.leafGeo[kind] = A.geometry((x, y) => y + 0.08); this.leafGeo[kind].tris = A.tris; }
    return this.leafGeo[kind];
  }
  // the plan drawn (what was drawn before thrown away): the blockers back
  build(plan, plain = null) {
    this.clear();
    const L = this.lay(plan, this.heightAt, plain), out = this.meshesOf(L, this.heightAt);
    for (const m of out.meshes) { this.scene.add(m); this.meshes.push(m); }
    this.gates = L.gates; this.leaves = out.leaves; this.info = { ...this.info, tris: out.tris, draws: out.meshes.length };   // (bytes, woodMs, stoneMs kept)
    return L.rails;
  }
  meshesOf(L, ground) {
    const meshes = [], leaves = {}; let tris = 0;
    if (L.wood.tris) { const m = new THREE.Mesh(L.wood.geometry((x, y, z) => y - ground(x, z)), this.mats.wood); m.castShadow = m.receiveShadow = this.shadows; m.name = 'fences:wood'; meshes.push(m); tris += L.wood.tris; }
    if (L.wire.tris) { const m = new THREE.Mesh(L.wire.geometry(), this.mats.wire); m.name = 'fences:wire'; m.renderOrder = 2; meshes.push(m); tris += L.wire.tris; }
    if (L.stones.length && this.mats.stone) { const g = mergeGeometries(L.stones); for (const s of L.stones) s.dispose(); const m = new THREE.Mesh(g, this.mats.stone); m.castShadow = m.receiveShadow = this.shadows; m.name = 'fences:stone'; meshes.push(m); tris += g.index.count / 3; }
    const byKind = {}; for (const gt of L.gates) (byKind[gt.kind] = byKind[gt.kind] || []).push(gt);
    for (const [kind, list] of Object.entries(byKind)) {
      const geo = this.leafGeometry(kind), m = new THREE.InstancedMesh(geo, this.mats.wood, list.length);
      m.castShadow = m.receiveShadow = this.shadows; m.frustumCulled = false; m.name = 'fences:gate:' + kind;
      list.forEach((gt, i) => { gt.mesh = m; gt.i = i; this.place(gt); });
      meshes.push(m); leaves[kind] = m; tris += geo.tris * list.length;
    }
    return { meshes, leaves, tris };
  }
  place(gt) {
    const M = new THREE.Matrix4().compose(new THREE.Vector3(...gt.hinge), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), gt.yaw + gt.ang * gt.dir), new THREE.Vector3(1, 1, 1));
    M.multiply(new THREE.Matrix4().set(1, 0, 0, 0, gt.rake || 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)).multiply(new THREE.Matrix4().makeScale(gt.sx, gt.sy, 1));   // (raked: y rises with x, along the leaf)
    gt.mesh.setMatrixAt(gt.i, M); gt.mesh.instanceMatrix.needsUpdate = true; gt.dirty = false;
  }
  clear() { for (const m of this.meshes) { this.scene.remove(m); if (m.geometry && !Object.values(this.leafGeo).includes(m.geometry)) m.geometry.dispose(); if (m.isInstancedMesh) m.dispose(); } this.meshes = []; this.gates = []; }

  // ── each frame: the gates swing open for anything near (and shut again a moment after it's gone), away from it ──
  update(dt, near = [], camera = null, renderer = null) {
    if (camera && renderer) { const h = renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2())).y || 1; this.U.uPix.value = 2 / (camera.projectionMatrix.elements[5] * h); }
    for (const gt of this.gates) {
      let who = null, best = gt.reach * gt.reach;
      for (const p of near || []) { if (!p) continue; const x = p.x ?? (p.position && p.position.x), z = p.z ?? (p.position && p.position.z); if (x === undefined) continue; const d = (x - gt.mid[0]) ** 2 + (z - gt.mid[1]) ** 2; if (d < best) { best = d; who = [x, z]; } }
      if (who) { gt.hold = 1.2; if (gt.ang < 0.05) { const side = gt.D[0] * (who[1] - gt.hinge[2]) - gt.D[2] * (who[0] - gt.hinge[0]); const t = gt.yaw + Math.PI / 2, tip = [Math.cos(t), -Math.sin(t)]; gt.dir = Math.sign(gt.D[0] * tip[1] - gt.D[2] * tip[0]) === Math.sign(side) ? -1 : 1; } }
      else gt.hold -= dt;
      const want = gt.force != null ? gt.force : gt.hold > 0 ? 1.75 : 0, was = gt.ang;
      gt.ang += Math.sign(want - gt.ang) * Math.min(Math.abs(want - gt.ang), dt * (0.6 + 1.6 * Math.abs(want - gt.ang)));
      if (Math.abs(gt.ang - was) > 1e-4 || gt.dirty) this.place(gt);
    }
  }
  // (rigs: every gate held open by `a` radians, or let go: null)
  holdGates(a) { for (const gt of this.gates) { gt.force = a; if (a != null) { gt.ang = a; this.place(gt); } } }

  // ── counted, and pictured ──
  samplePlan(style, len = 10, gate = false) {
    const pts = [[0, 0], [len, 0]], st = { seed: 7, size: 1, style };
    const run = { si: 0, stroke: st, style: FENCE_STYLES[style] ? style : null, size: 1, pts, cum: [0, len], len, gaps: [], pieces: [{ a: 0, b: len, pts, gateA: false, gateB: false }] };
    const plan = { runs: [run], gates: [] };
    if (gate) {
      const kind = styleInfo(run.style).gate, w = GATES[kind].w, s = len / 2;
      run.pieces = [{ a: 0, b: s - w / 2, pts: [[0, 0], [s - w / 2, 0]], gateA: false, gateB: true }, { a: s + w / 2, b: len, pts: [[s + w / 2, 0], [len, 0]], gateA: true, gateB: false }];
      plan.gates.push({ gi: 1, id: 'g', run, kind, s, a: s - w / 2, b: s + w / 2, A: [s - w / 2, 0], B: [s + w / 2, 0], w });
    }
    return plan;
  }
  // (the plain fence as valley.js lays it on flat ground: a post every 2.2 m, two rails between)
  plainSample(len, h = 1.1) {
    const posts = [], rails = []; for (let x = 0; x <= len + 1e-6; x += 2.2) { posts.push([[x, 0, 0], h]); if (x > 0) rails.push([[x - 2.2, 0, 0], [x, 0, 0], h]); }
    return { posts, rails };
  }
  sample(style, { len = 10, gate = false } = {}) {
    const plain = !FENCE_STYLES[style], plan = this.samplePlan(style, len, gate);
    if (plain) { plan.runs = []; }
    const L = this.lay(plan, () => 0, plain ? this.plainSample(len) : null);
    let stone = 0; for (const g of L.stones) { stone += g.index.count / 3; g.dispose(); }
    const leaves = L.gates.reduce((s, gt) => s + this.leafGeometry(gt.kind).tris, 0);
    return { wood: L.wood.tris, wire: L.wire.tris, stone, leaves, tris: L.wood.tris + L.wire.tris + stone + leaves, draws: (L.wood.tris ? 1 : 0) + (L.wire.tris ? 1 : 0) + (stone ? 1 : 0) + (L.gates.length ? 1 : 0) };
  }
  // a small picture of a style: a short run with a gate in it, on a little patch of ground, from a little above
  icon(style, renderer, w = 120, h = 80) {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, w / h, 0.05, 100);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a30, 1.6)); const sun = new THREE.DirectionalLight(0xfff2dd, 2.6); sun.position.set(-2, 5, 4); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 8).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5e7a35 })); scene.add(ground);
    const plain = !FENCE_STYLES[style];
    { const plan = this.samplePlan(style, style === 'wire' ? 8 : style === 'stone' ? 7.2 : 4.4, false); if (plain) plan.runs = [];
      const L = this.lay(plan, () => 0, plain ? this.plainSample(4.4) : null), out = this.meshesOf(L, () => 0);
      for (const m of out.meshes) scene.add(m);
      scene.userData.dispose = () => out.meshes.forEach((m) => m.geometry.dispose()); }
    const H = plain ? 1.1 : FENCE_STYLES[style].h, span = plain ? 4.4 : style === 'wire' ? 8 : style === 'stone' ? 7.2 : 4.4;
    cam.position.set(span * 0.5 - span * 0.42, H * 1.7 + 0.6, span * 0.95 + 1.2); cam.lookAt(span * 0.5, H * 0.45, 0);
    const rt = new THREE.WebGLRenderTarget(w * 2, h * 2, { samples: renderer.capabilities.isWebGL2 ? 4 : 0 }), px = new Uint8Array(w * 2 * h * 2 * 4);
    const oldT = renderer.getRenderTarget(), oldC = renderer.getClearColor(new THREE.Color()), oldA = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0xbcd2e6, 1); renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, w * 2, h * 2, px);
    renderer.setRenderTarget(oldT); renderer.setClearColor(oldC, oldA); rt.dispose(); if (scene.userData.dispose) scene.userData.dispose();
    // (a render target is drawn in linear light, untoned: brought to the screen's sRGB here)
    const lut = new Uint8Array(256); for (let i = 0; i < 256; i++) { const c = Math.min(1, i / 255 * 1.15); lut[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
    for (let i = 0; i < px.length; i += 4) { px[i] = lut[px[i]]; px[i + 1] = lut[px[i + 1]]; px[i + 2] = lut[px[i + 2]]; }
    const big = document.createElement('canvas'); big.width = w * 2; big.height = h * 2; const g = big.getContext('2d'), img = g.createImageData(w * 2, h * 2);
    for (let y = 0; y < h * 2; y++) img.data.set(px.subarray((h * 2 - 1 - y) * w * 2 * 4, (h * 2 - y) * w * 2 * 4), y * w * 2 * 4);
    g.putImageData(img, 0, 0);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(big, 0, 0, w, h);
    return cv.toDataURL('image/png');
  }
}
export { FENCE_STYLES, PLAIN };
