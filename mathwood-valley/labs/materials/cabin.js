// THE CABIN, BUILT FROM PARTS IN CODE: every board, post, shingle and stone is a box, and the boxes are merged into one
// mesh per material (wood, stone, iron, glass), so the whole cabin is four draw calls however many parts it has.
//
// Each box carries extra numbers per corner (vertex attributes) for the weathering shader (weather.js):
//   aLocalTop  xyz: where this corner is inside its own box (metres from the box's middle), so the shader can tell how
//              far a pixel is from the box's nearest edge (edge wear); w: the height of the roof edge above it (water
//              runs down the wall from there: grime streaks)
//   aHalf      xyz: the box's half size (with aLocalTop, the edge distance); w: how open this corner is to falling
//              rain (baked below with the AO: a porch floor under its roof stays dry, so no moss)
//   aTintPaint rgb: this board's own colour tint (no two boards alike); a: 1 if painted, then rgb is the paint colour
//   aAO        how open this corner is to the sky, 0..1 (ambient occlusion, baked once from the parts' layout below)
//
// Layout: the cabin's middle is at x = z = 0, the ground at y = 0, the front (door, porch) faces +z (south),
// +x is east, -z north. Metres.

import * as THREE from 'three';
import { rng, WOOD } from './textures.js';

const W = 6.4, D = 4.8;                 // outside of the walls: width (x), depth (z)
const FOOT = 0.5, SILL = 0.18;          // top of the stone footing; the sill log on it
const WALL0 = FOOT + SILL;              // the first board's bottom
const EAVE = 3.25;                      // top of the walls
const PITCH = 34 * Math.PI / 180;       // main roof slope
const RIDGE = EAVE + (D / 2) * Math.tan(PITCH);
const PD = 1.9;                         // porch depth
const DECK = FOOT + 0.08;               // porch floor
const P_TOP = EAVE - 0.22, P_PITCH = 14 * Math.PI / 180;   // the porch's lean-to roof meets the wall here
const CH = { x0: -W / 2 - 0.78, x1: -W / 2 - 0.02, z0: -0.52, z1: 0.52, top: RIDGE + 0.75 };   // the chimney's footprint
export const CABIN = { W, D, FOOT, EAVE, RIDGE, PD, DECK };

// the height of the roof edge water drips from, above a point: what the grime streaks run down from
export function topAt(x, z) {
  if (x < -W / 2 - 0.03 && z > CH.z0 - 0.05 && z < CH.z1 + 0.05) return CH.top;                       // the chimney
  if (z > D / 2 + 0.02) return P_TOP - (z - D / 2) * Math.tan(P_PITCH) - 0.05;                          // under the porch roof
  return Math.max(EAVE, RIDGE - Math.abs(z) * Math.tan(PITCH)) - 0.02;                                  // under the main roof
}

// ── the parts kit ─────────────────────────────────────────────────────────────────────────────────────────────────────
const _v = new THREE.Vector3(), _n = new THREE.Vector3();
export class Kit {
  constructor(seed) { this.R = rng(seed); this.parts = { wood: [], stone: [], iron: [], glass: [] }; this.occ = []; this.holes = []; }
  r(a, b) { return a + (b - a) * this.R(); }
  // a box: size [x, y, z] in metres, at pos, turned by rot (radians, YXZ order) or given a whole matrix `m`.
  // o: long (grain axis 0/1/2, default its longest side), tint [r,g,b], paint [r,g,b], strip (trim sheet row), uShift
  //    and, for a cheaper or rougher part (the frontier cabin uses these; see buildGeometry):
  //    skip  faces nobody can see, left out: a string of '+x' '-x' '+y' '-y' '+z' '-z' (in the box's own frame)
  //    cuts  extra rows of corners along the long side (local metres from the middle), so the baked shading has
  //          somewhere to change along a long log; segFaces: only on these faces (same keys)
  //    slope the top face sheared along local x, rising k metres per metre (a gable board cut to the roof line)
  //    warp  a name handed to the build's warp function, which bends the finished corners (a sagging roof)
  //    span  how many trim sheet strips run across the board (2 on a wide shake: the bevel between them reads as a split)
  //    mortar  (stone) mortar or chinking: its tint is evened out against whichever rock texture is chosen
  box(group, size, pos, rot = null, o = {}) {
    const m = o.m ? o.m.clone() : new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ')), new THREE.Vector3(1, 1, 1));
    if (o.m && pos) m.multiplyMatrices(new THREE.Matrix4().makeTranslation(...pos), m);
    this.parts[group].push({ size, m, o }); return m;
  }
  // a prism: the outline `poly` ([x, z] points round its middle, in order) stood up along local y, `len` tall. For round
  // things in a box world: posts, poles, a barrel (n-sided, smooth: true shades it round), split firewood (3-sided).
  // Its ends are the end grain; o.skip '+y' / '-y' leaves an end out (a post's foot on the deck).
  prism(group, poly, len, pos, rot = null, o = {}) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return this.box(group, [x1 - x0, len, z1 - z0], pos, rot, { long: 1, ...o, poly });
  }
  // a solid block that blocks light for the ambient occlusion bake (not drawn)
  solid(size, pos, rot = null, m = null) {
    m = m ? m.clone() : new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ')), new THREE.Vector3(1, 1, 1));
    this.occ.push({ size, m });
  }
  board(size, pos, rot, o = {}) {
    const R = this.R, t = o.tint || [1, 1, 1], j = 0.12;
    const tint = [t[0] * (1 + (R() - 0.5) * j), t[1] * (1 + (R() - 0.5) * j), t[2] * (1 + (R() - 0.5) * j * 1.3)];
    return this.box('wood', size, pos, rot, { strip: Math.floor(R() * 10), ...o, tint });
  }
}

// ── the cabin's layout ────────────────────────────────────────────────────────────────────────────────────────────────
const SIDING = [1, 1, 1], WEATHERED = [0.9, 0.93, 0.97], TRIM = [0.86, 0.82, 0.72], DOOR = [0.42, 0.12, 0.09];
const DARK = [0.7, 0.66, 0.62];

function footing(k) {
  // two courses of stones under the walls, a little proud of the boards, each its own size and a little skew
  const ring = [[-W / 2, D / 2, W / 2, D / 2, 0], [W / 2, -D / 2, -W / 2, -D / 2, 0], [W / 2, D / 2, W / 2, -D / 2, 1], [-W / 2, -D / 2, -W / 2, D / 2, 1]];
  for (const [x0, z0, x1, z1, side] of ring) {
    const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len, nx = -dz, nz = dx;   // nx, nz: outward
    for (let course = 0; course < 2; course++) {
      const yb = course * 0.25; let s = course ? -0.15 : 0.05;
      while (s < len + 0.1) {
        const L = k.r(0.32, 0.62), h = k.r(0.2, 0.26), dpt = k.r(0.32, 0.4), cs = Math.min(len + 0.2, s + L) ;
        const mid = (s + cs) / 2, px = x0 + dx * mid + nx * (0.04 - dpt / 2), pz = z0 + dz * mid + nz * (0.04 - dpt / 2);
        const sz = side ? [dpt, h, cs - s - 0.025] : [cs - s - 0.025, h, dpt];
        k.box('stone', sz, [px, yb + h / 2 + k.r(-0.01, 0.01), pz], [k.r(-0.03, 0.03), k.r(-0.05, 0.05), k.r(-0.03, 0.03)]);
        s = cs;
      }
    }
  }
  k.solid([W - 0.1, FOOT, D - 0.1], [0, FOOT / 2, 0]);
}

// one wall of lap siding with its openings: `along` runs from a0 to a1, `place(a, y, len)` gives [pos, rot, size] for a board
function siding(k, a0, a1, yTop, openings, place, rowLimit, long = 0) {
  const bh = 0.2, expo = 0.17;
  let row = 0;
  for (let yb = WALL0; yb < yTop - 0.04; yb += expo, row++) {
    let lo = a0, hi = a1;
    if (rowLimit) { const lim = rowLimit(yb + bh / 2); if (lim <= 0.05) break; lo = Math.max(a0, -lim); hi = Math.min(a1, lim); }
    // the row's pieces: cut round the openings it crosses
    let spans = [[lo, hi]];
    for (const o of openings) if (yb < o.y1 && yb + bh > o.y0) spans = spans.flatMap(([s, e]) => (o.a1 <= s || o.a0 >= e ? [[s, e]] : [[s, o.a0], [o.a1, e]].filter(([p, q]) => q - p > 0.04)));
    for (const [s, e] of spans) {
      // long runs are two or three boards, joints staggered row to row (as real siding, never all on one stud)
      let cut = s;
      const joints = [];
      let next = s + 1.2 * (1 + ((row * 0.37) % 1));
      while (next < e - 0.6) { joints.push(next); next += 1.2 * (1 + k.R()); }
      // under a window the boards are cut at the sill's ends, so those pieces can carry the sill as their drip edge
      // (water runs off the sill and streaks the wall below it)
      const drips = openings.filter((o) => o.sill && yb + bh < o.y0 && o.a0 - 0.16 > s && o.a1 + 0.16 < e);
      let cuts = joints;
      for (const o of drips) cuts = [...cuts.filter((j) => j < o.a0 - 0.45 || j > o.a1 + 0.45), o.a0 - 0.16, o.a1 + 0.16];
      cuts.sort((p, q) => p - q);
      for (const j of [...cuts, e]) {
        const len = j - cut - 0.004, mid = (cut + j) / 2, under = drips.find((o) => mid > o.a0 - 0.16 && mid < o.a1 + 0.16);
        if (len > 0.03) { const [pos, rot, size] = place(mid, yb + bh / 2, len); k.board(size, pos, rot, { long, tint: SIDING, top: under ? under.y0 - 0.1 : undefined }); }
        cut = j;
      }
    }
  }
}

function walls(k) {
  const t = 0.025, tilt = Math.atan2(0.022, 0.2), out = 0.012;
  const door = { a0: -1.42, a1: -0.38, y0: WALL0 - 0.1, y1: 2.78 };
  const winF = { a0: 1.05, a1: 2.15, y0: 1.45, y1: 2.5, sill: true }, winS = { a0: -0.55, a1: 0.55, y0: 1.5, y1: 2.45, sill: true }, winB = { a0: -0.5, a1: 0.5, y0: 1.6, y1: 2.35, sill: true };
  const inner = W / 2 - 0.18, innerD = D / 2 - 0.18;
  // front (+z) and back (-z): boards along x, the bottom edge kicked out (lap siding)
  siding(k, -inner, inner, EAVE, [door, winF], (a, y, len) => [[a, y, D / 2 - t / 2 + out], [-tilt, 0, 0], [len, 0.2, t]]);
  siding(k, -inner, inner, EAVE, [{ ...winB, a0: -winB.a1 + 0.9, a1: -winB.a0 + 0.9 }], (a, y, len) => [[a, y, -D / 2 + t / 2 - out], [tilt, 0, 0], [len, 0.2, t]]);
  // the ends (+x east, -x west) run up into the gables: each row as wide as the roof lets it
  const gable = (y) => (y < EAVE ? innerD : Math.min(D / 2, (RIDGE - y - 0.08) / Math.tan(PITCH)));
  const gableFull = (y) => (y < EAVE ? D / 2 : gable(y));
  const ends = (sx) => {
    const lim = (y) => (y < EAVE - 0.01 ? innerD : gableFull(y));
    siding(k, -D / 2, D / 2, RIDGE - 0.12, sx > 0 ? [winS] : [], (a, y, len) => [[sx * (W / 2 - t / 2 + out), y, a], [0, 0, sx * tilt], [t, 0.2, len]], lim, 2);
  };
  ends(1); ends(-1);
  // the light-blocking core: the walls' inside, and the attic under the gables
  k.solid([W - 0.08, EAVE - FOOT, D - 0.08], [0, (EAVE + FOOT) / 2, 0]);
  for (let i = 0; i < 5; i++) { const y0 = EAVE + i * (RIDGE - EAVE) / 5, y1 = y0 + (RIDGE - EAVE) / 5, hw = (RIDGE - y1) / Math.tan(PITCH); k.solid([W - 0.08, y1 - y0, Math.max(0.05, 2 * hw)], [0, (y0 + y1) / 2, 0]); }

  // corner posts (hewn logs, square) and the sill logs on the footing
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.board([0.22, EAVE - WALL0 + 0.02, 0.22], [sx * (W / 2 - 0.09), (EAVE + WALL0) / 2, sz * (D / 2 - 0.09)], null, { long: 1, tint: DARK, strip: 10 + (sx > 0 ? 1 : 0) });
  k.board([W + 0.06, SILL, 0.24], [0, FOOT + SILL / 2, D / 2 - 0.09], null, { long: 0, tint: DARK, strip: 10 });
  k.board([W + 0.06, SILL, 0.24], [0, FOOT + SILL / 2, -D / 2 + 0.09], null, { long: 0, tint: DARK, strip: 11 });
  k.board([0.24, SILL, D - 0.4], [W / 2 - 0.09, FOOT + SILL / 2, 0], null, { long: 2, tint: DARK, strip: 10 });
  k.board([0.24, SILL, D - 0.4], [-W / 2 + 0.09, FOOT + SILL / 2, 0], null, { long: 2, tint: DARK, strip: 11 });
  // the frieze board under the eaves (front and back)
  k.board([W - 0.3, 0.2, 0.03], [0, EAVE - 0.08, D / 2 + 0.03], null, { long: 0, tint: TRIM, paint: TRIM });
  k.board([W - 0.3, 0.2, 0.03], [0, EAVE - 0.08, -D / 2 - 0.03], null, { long: 0, tint: TRIM, paint: TRIM });

  // windows: a painted frame, a sill that sticks out (it faces up: moss and grime find it), glass, a cross of glazing bars
  const windowAt = (o, place) => {   // place(a, y, outward) -> [pos, rot] in the wall's frame; sizes are [along, up, out]
    const fw = 0.09, ft = 0.04, w = o.a1 - o.a0, h = o.y1 - o.y0, ac = (o.a0 + o.a1) / 2, yc = (o.y0 + o.y1) / 2;
    const add = (group, sz, a, y, outv, opt = {}) => { const [pos, rot, size, swap] = place(a, y, outv, sz); if (swap && opt.long !== undefined && opt.long !== 1) opt = { ...opt, long: 2 - opt.long }; if (group === 'wood') k.board(size, pos, rot, opt); else k.box(group, size, pos, rot, opt); };
    add('wood', [fw, h + fw * 2, ft], o.a0 - fw / 2, yc, 0.045, { long: 1, tint: TRIM, paint: TRIM });
    add('wood', [fw, h + fw * 2, ft], o.a1 + fw / 2, yc, 0.045, { long: 1, tint: TRIM, paint: TRIM });
    add('wood', [w, fw, ft], ac, o.y1 + fw / 2, 0.045, { long: 0, tint: TRIM, paint: TRIM });
    add('wood', [w + 0.32, 0.05, 0.13], ac, o.y0 - 0.025, 0.07, { long: 0, tint: TRIM, paint: TRIM });                    // the sill
    add('wood', [w + 0.04, 0.12, 0.035], ac, o.y0 - 0.11, 0.035, { long: 0, tint: TRIM, paint: TRIM });                    // its apron
    add('glass', [w, h, 0.02], ac, yc, -0.07);
    add('wood', [0.035, h, 0.03], ac, yc, -0.04, { long: 1, tint: TRIM, paint: TRIM });
    add('wood', [w, 0.035, 0.03], ac, yc + h * 0.05, -0.04, { long: 0, tint: TRIM, paint: TRIM });
  };
  const frontPl = (a, y, o, sz) => [[a, y, D / 2 + o], null, sz];
  const backPl = (a, y, o, sz) => [[a, y, -D / 2 - o], null, sz];
  const eastPl = (a, y, o, sz) => [[W / 2 + o, y, -a], null, [sz[2], sz[1], sz[0]], true];
    windowAt(winF, frontPl); windowAt({ ...winB, a0: -winB.a1 + 0.9, a1: -winB.a0 + 0.9 }, backPl); windowAt(winS, eastPl);

  // the door: six painted planks on two battens and a brace (a Z), strap hinges, a latch; a plain frame round it
  const dw = door.a1 - door.a0, dh = door.y1 - (WALL0 - 0.06), dy0 = WALL0 - 0.06, dz = D / 2 - 0.01;
  for (let i = 0; i < 6; i++) k.board([dw / 6 - 0.006, dh, 0.04], [door.a0 + (i + 0.5) * dw / 6, dy0 + dh / 2, dz], null, { long: 1, paint: DOOR, tint: DOOR });
  for (const yy of [dy0 + 0.35, door.y1 - 0.35]) k.board([dw - 0.08, 0.13, 0.03], [(door.a0 + door.a1) / 2, yy, dz + 0.035], null, { long: 0, paint: DOOR, tint: DOOR });
  const br = Math.atan2(door.y1 - dy0 - 0.7, dw - 0.2), bl = Math.hypot(door.y1 - dy0 - 0.7, dw - 0.2);
  k.board([bl, 0.12, 0.03], [(door.a0 + door.a1) / 2, (dy0 + door.y1) / 2, dz + 0.035], [0, 0, br], { long: 0, paint: DOOR, tint: DOOR });
  for (const yy of [dy0 + 0.35, door.y1 - 0.35]) { k.box('iron', [0.42, 0.045, 0.01], [door.a0 + 0.2, yy, dz + 0.055]); k.box('iron', [0.05, 0.12, 0.03], [door.a0 + 0.02, yy, dz + 0.04]); }
  k.box('iron', [0.03, 0.16, 0.025], [door.a1 - 0.12, 1.75, dz + 0.035]); k.box('iron', [0.12, 0.025, 0.04], [door.a1 - 0.12, 1.68, dz + 0.06]);
  k.board([0.1, door.y1 - dy0 + 0.1, 0.04], [door.a0 - 0.05, (dy0 + door.y1) / 2 + 0.05, D / 2 + 0.03], null, { long: 1, tint: TRIM, paint: TRIM });
  k.board([0.1, door.y1 - dy0 + 0.1, 0.04], [door.a1 + 0.05, (dy0 + door.y1) / 2 + 0.05, D / 2 + 0.03], null, { long: 1, tint: TRIM, paint: TRIM });
  k.board([dw + 0.3, 0.12, 0.045], [(door.a0 + door.a1) / 2, door.y1 + 0.06, D / 2 + 0.03], null, { long: 0, tint: TRIM, paint: TRIM });
  k.solid([dw, door.y1 - dy0, 0.1], [(door.a0 + door.a1) / 2, (door.y1 + dy0) / 2, D / 2 - 0.05]);
}

// one roof slope, built in its own frame (the top edge along x at height topY, z = 0; it runs down toward +z) and then
// moved into place by M: sheathing, rafters, fascia, barge boards and the courses of shingles
function slope(k, M, o) {
  const { x0, x1, topY, len, pitch, cap } = o;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const up = new THREE.Vector3(0, sp, -cp), nrm = new THREE.Vector3(0, cp, sp);
  const eave = new THREE.Vector3(0, topY - len * sp, len * cp);
  const at = (x, s, n) => eave.clone().addScaledVector(up, s).addScaledVector(nrm, n).setX(x);
  const R = new THREE.Matrix4().makeRotationX(pitch);                                    // a box's z down the slope, y out of it
  const place = (group, size, x, s, n, extra, opt = {}) => {
    const m = new THREE.Matrix4().multiplyMatrices(M, new THREE.Matrix4().makeTranslation(...at(x, s, n).toArray()));
    m.multiply(R); if (extra) m.multiply(extra);
    if (group === 'solid') k.solid(size, null, null, m); else if (group === 'wood') k.board(size, null, null, { ...opt, m }); else k.box(group, size, null, null, { ...opt, m });
    return m;
  };
  // the roof boards under the shingles (seen from below at the eaves and the porch), and the slab that blocks the light
  for (let s = 0; s < len; s += 0.2) for (const [a, b] of [[x0, (x0 + x1) / 2 + 0.3 * Math.sin(s * 9)], [(x0 + x1) / 2 + 0.3 * Math.sin(s * 9), x1]]) place('wood', [b - a - 0.004, 0.022, 0.196], (a + b) / 2, s + 0.1, -0.011, null, { long: 0, tint: DARK });
  place('solid', [x1 - x0, 0.1, len], (x0 + x1) / 2, len / 2, -0.07);
  // rafters every 0.6 m, and the boards along the edges
  for (let x = x0 + 0.12; x < x1 - 0.05; x += 0.6) if (!o.skipRafter || !o.skipRafter(x)) place('wood', [0.06, 0.14, len - 0.02], x, len / 2, -0.093, null, { long: 2, tint: DARK, strip: 10 });
  place('wood', [x1 - x0 + 0.06, 0.035, 0.2], (x0 + x1) / 2, -0.012, -0.05, new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.0), { long: 0, tint: TRIM, paint: TRIM });   // fascia
  for (const x of [x0 - 0.02, x1 + 0.02]) if (!o.noBarge) place('wood', [0.04, 0.2, len + 0.02], x, len / 2, -0.04, null, { long: 2, tint: TRIM, paint: TRIM });
  // shingles: courses up from the eave, each butt lifted a little by the course under it (the shadow lines)
  const expo = 0.15, SL = 0.42, th = 0.016, lift = new THREE.Matrix4().makeRotationX(-0.035);
  const MW = new THREE.Vector3();
  let row = 0;
  for (let s = -0.03; s < len - 0.12; s += expo, row++) {
    let x = x0 - 0.04 - k.R() * 0.15;
    while (x < x1 + 0.04) {
      const w = Math.min(x1 + 0.05 - x, k.r(0.14, 0.32)); if (w < 0.06) break;
      const L = Math.min(SL, len - s + 0.02), cx = x + w / 2;
      MW.copy(at(cx, s + L / 2, 0)).applyMatrix4(M);
      if (!(o.hole && o.hole(MW.x, MW.z))) {
        const g = 0.8 + k.R() * 0.16, tint = k.R() < 0.2 ? [g * 0.92, g * 0.93, g * 0.95] : [g, g * 0.95, g * 0.9];   // cedar gone grey, a few darker
        place('wood', [w - 0.008, th, L], cx, s + L / 2, th / 2 + 0.006 + 0.004 * (row % 2), lift, { long: 2, strip: 1 + 2 * Math.floor(k.R() * 5), tint: [tint[0] * WEATHERED[0], tint[1] * WEATHERED[1], tint[2]] });   // the greyer strips
      }
      x += w;
    }
  }
  if (cap) place('wood', [x1 - x0 + 0.04, 0.025, 0.17], (x0 + x1) / 2, len - 0.02, 0.05, null, { long: 0, tint: DARK });
}

function roofs(k) {
  const gx = 0.38, ovF = 0.14, ovB = 0.5;
  const hole = (x, z) => x > CH.x0 - 0.06 && x < CH.x1 + 0.12 && z > CH.z0 - 0.06 && z < CH.z1 + 0.06;
  const skipRafter = (x) => x < -W / 2 + 0.02 && x > -W / 2 - 0.85;
  // front slope (it ends just past the wall: the porch roof tucks under it) and back slope (a deeper overhang)
  const lenF = (D / 2 + ovF) / Math.cos(PITCH), lenB = (D / 2 + ovB) / Math.cos(PITCH);
  slope(k, new THREE.Matrix4().makeTranslation(0, 0.02, 0), { x0: -W / 2 - gx, x1: W / 2 + gx, topY: RIDGE + 0.02, len: lenF, pitch: PITCH, hole, cap: true, skipRafter });
  slope(k, new THREE.Matrix4().makeRotationY(Math.PI).premultiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0)), { x0: -W / 2 - gx, x1: W / 2 + gx, topY: RIDGE + 0.02, len: lenB, pitch: PITCH, hole: (x, z) => hole(x, z), cap: true, skipRafter: (x) => -x < -W / 2 + 0.02 && -x > -W / 2 - 0.85 });
  // the porch's lean-to: from the wall under the main eave, down past the porch posts
  const lenP = (PD + 0.3) / Math.cos(P_PITCH);
  slope(k, new THREE.Matrix4().makeTranslation(0, 0, D / 2 + 0.02), { x0: -W / 2 - 0.12, x1: W / 2 + 0.12, topY: P_TOP, len: lenP, pitch: P_PITCH });
}

function porch(k) {
  const z0 = D / 2 + 0.02, z1 = D / 2 + PD, postZ = z1 - 0.12, xs = [-W / 2 + 0.02, -1.72, -0.08, W / 2 - 0.02];
  const beamY = P_TOP - (postZ - D / 2) * Math.tan(P_PITCH) - 0.17;
  // the deck: boards along x on joists along z, a rim board along the front
  for (let z = z0 + 0.075; z < z1 - 0.05; z += 0.152) {
    const j = k.r(-1, 1.5);
    k.board([W / 2 + 0.12 + j - 0.004, 0.035, 0.14], [(-W / 2 - 0.12 + j) / 2, DECK - 0.018, z], null, { long: 0, tint: WEATHERED });
    k.board([W / 2 + 0.12 - j - 0.004, 0.035, 0.14], [(W / 2 + 0.12 + j) / 2, DECK - 0.018, z], null, { long: 0, tint: WEATHERED });
  }
  for (const x of [-W / 2 + 0.05, -1.7, 0, 1.6, W / 2 - 0.05]) k.board([0.07, 0.17, PD], [x, DECK - 0.12, D / 2 + PD / 2], null, { long: 2, tint: DARK, strip: 10 });
  k.board([W + 0.24, 0.2, 0.04], [0, DECK - 0.1, z1 + 0.02], null, { long: 0, tint: DARK, strip: 11 });
  k.solid([W + 0.2, DECK - 0.03, PD], [0, (DECK - 0.03) / 2, D / 2 + PD / 2]);
  // stone piers under the posts
  for (const x of xs) { k.box('stone', [0.36, 0.22, 0.34], [x, 0.11, postZ], [0, k.r(-0.2, 0.2), 0]); k.box('stone', [0.28, 0.22, 0.28], [x, 0.31, postZ], [0, k.r(-0.3, 0.3), 0]); }
  // posts, the beam on them, and the rails (top rail, bottom rail, balusters) except where the steps come up
  for (const x of xs) k.board([0.14, beamY - DECK, 0.14], [x, (beamY + DECK) / 2, postZ], null, { long: 1, tint: DARK, strip: 10 });
  k.board([W + 0.16, 0.17, 0.13], [0, beamY + 0.085, postZ], null, { long: 0, tint: DARK, strip: 11 });
  const rail = (a, b, along) => {   // along 'x' at z = postZ, or 'z' at x = a fixed x (a, b then z's)
    const L = Math.abs(b - a), m = (a + b) / 2;
    for (const [y, sz] of [[DECK + 0.92, [0.07, 0.055]], [DECK + 0.12, [0.06, 0.05]]]) {
      if (along.x !== undefined) k.board([sz[1], sz[0], L], [along.x, y, m], null, { long: 2, tint: WEATHERED });
      else k.board([L, sz[0], sz[1]], [m, y, postZ], null, { long: 0, tint: WEATHERED });
    }
    for (let s = 0.12; s < L - 0.06; s += 0.13) {
      const p = Math.min(a, b) + s;
      if (along.x !== undefined) k.board([0.035, 0.76, 0.035], [along.x, DECK + 0.52, p], null, { long: 1, tint: WEATHERED });
      else k.board([0.035, 0.76, 0.035], [p, DECK + 0.52, postZ], null, { long: 1, tint: WEATHERED });
    }
  };
  rail(xs[0] + 0.07, xs[1] - 0.07, {}); rail(xs[2] + 0.07, xs[3] - 0.07, {});
  rail(D / 2 + 0.1, postZ - 0.07, { x: xs[0] }); rail(D / 2 + 0.1, postZ - 0.07, { x: xs[3] });
  // the steps: three treads down to the ground on two stringers, a stone at the foot
  const sx0 = xs[1] + 0.12, sx1 = xs[2] - 0.12;
  for (let i = 1; i <= 3; i++) {
    const y = DECK - i * 0.145, zz = z1 + (i - 0.5) * 0.28;
    k.board([sx1 - sx0, 0.035, 0.135], [(sx0 + sx1) / 2, y - 0.018, zz - 0.07], null, { long: 0, tint: WEATHERED });
    k.board([sx1 - sx0, 0.035, 0.135], [(sx0 + sx1) / 2, y - 0.018, zz + 0.07], null, { long: 0, tint: WEATHERED });
  }
  const sa = Math.atan2(DECK, 0.84), sl = Math.hypot(DECK, 0.84) + 0.1;
  for (const x of [sx0 + 0.03, sx1 - 0.03]) k.board([0.05, 0.22, sl], [x, DECK / 2 - 0.12, z1 + 0.42], [sa, 0, 0], { long: 2, tint: DARK, strip: 11 });
  k.box('stone', [sx1 - sx0 + 0.2, 0.12, 0.42], [(sx0 + sx1) / 2, 0.04, z1 + 0.95], [0, 0.03, 0]);
}

function chimney(k) {
  // coursed stone: each course a running bond of stones across the stack's footprint, the joints shifting course to course
  const H0 = 2.3;   // where the shoulders step it in
  let y = 0, c = 0;
  while (y < CH.top - 0.05) {
    const h = k.r(0.18, 0.27), narrow = y > H0, inset = narrow ? 0.14 : 0;
    const x0 = CH.x0 + inset, x1 = CH.x1, z0 = CH.z0 + inset, z1 = CH.z1 - inset;
    const alongZ = c % 2 === 0;
    const [a0, a1, b0, b1] = alongZ ? [z0, z1, x0, x1] : [x0, x1, z0, z1];
    // two rows of stones across the depth, each row cut into random lengths
    for (let r = 0; r < 2; r++) {
      const bb0 = b0 + (b1 - b0) * r / 2, bb1 = b0 + (b1 - b0) * (r + 1) / 2;
      let a = a0;
      while (a < a1 - 0.05) {
        const L = Math.min(a1 - a, k.r(0.22, 0.42)), m = a + L / 2, bm = (bb0 + bb1) / 2;
        const sz = alongZ ? [bb1 - bb0 - 0.02 + k.r(0, 0.03), h - 0.02, L - 0.02] : [L - 0.02, h - 0.02, bb1 - bb0 - 0.02 + k.r(0, 0.03)];
        const pos = alongZ ? [bm, y + h / 2, m] : [m, y + h / 2, bm];
        k.box('stone', sz, pos, [k.r(-0.03, 0.03), k.r(-0.06, 0.06), k.r(-0.03, 0.03)]);
        a += L;
      }
    }
    y += h; c++;
  }
  k.box('stone', [CH.x1 - CH.x0 - 0.04, 0.08, CH.z1 - CH.z0 - 0.2], [(CH.x0 + CH.x1) / 2 + 0.07, CH.top + 0.02, 0]);   // the cap stone
  k.box('iron', [0.3, 0.02, 0.3], [(CH.x0 + CH.x1) / 2 + 0.07, CH.top + 0.065, 0]);                                      // the flue's dark mouth
  k.solid([CH.x1 - CH.x0, H0, CH.z1 - CH.z0], [(CH.x0 + CH.x1) / 2, H0 / 2, 0]);
  k.solid([CH.x1 - CH.x0 - 0.14, CH.top - H0, CH.z1 - CH.z0 - 0.28], [(CH.x0 + CH.x1) / 2 + 0.07, (CH.top + H0) / 2, 0]);
}

function extras(k) {
  // a rain barrel at the north-east corner and a short stack of firewood along the west wall: things to be tucked
  // in behind (moss, grime), and round parts in a box world (made of staves)
  const bx = W / 2 + 0.45, bz = -D / 2 + 0.35, R = 0.32, n = 14;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    k.board([2 * R * Math.sin(Math.PI / n) + 0.005, 0.85, 0.03], [bx + Math.cos(a) * R, 0.43, bz + Math.sin(a) * R], [0, -a + Math.PI / 2, 0], { long: 1, tint: DARK });
  }
  for (const y of [0.15, 0.7]) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box('iron', [2 * (R + 0.02) * Math.sin(Math.PI / 8) + 0.01, 0.05, 0.012], [bx + Math.cos(a) * (R + 0.018), y, bz + Math.sin(a) * (R + 0.018)], [0, -a + Math.PI / 2, 0]); }
  k.box('glass', [R * 1.7, 0.01, R * 1.7], [bx, 0.78, bz]);   // dark water
  k.solid([0.6, 0.86, 0.6], [bx, 0.43, bz]);
  // firewood: split logs (square-ish billets) stacked on two rails along the back of the west side
  const fx = -W / 2 - 0.35;
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
    const z = -D / 2 + 0.5 + i * 0.17 + (row % 2) * 0.08; if (z > CH.z0 - 0.2) continue;
    k.board([0.45, 0.13, 0.14], [fx + k.r(-0.03, 0.03), 0.1 + row * 0.135, z], [k.r(-0.04, 0.04), k.r(-0.06, 0.06), k.r(-0.03, 0.03)], { long: 0, tint: DARK, strip: 11 });
  }
  k.solid([0.45, 0.6, 1.3], [fx, 0.3, -D / 2 + 1.0]);
}

// ── turning the parts into meshes ─────────────────────────────────────────────────────────────────────────────────────
const FACES = [];
for (let a = 0; a < 3; a++) for (const s of [1, -1]) FACES.push({ a, s, b: (a + 1) % 3, c: (a + 2) % 3, key: (s > 0 ? '+' : '-') + 'xyz'[a] });

// where a face's rows of corners sit along one of its sides: just the two edges, unless the part asks for cuts along its
// long side (and this face is one it wants cut)
function stepsAlong(o, F, axis, half, long) {
  const h = half[axis];
  if (axis !== long || !o.cuts || (o.segFaces && !o.segFaces.includes(F.key))) return [-h, h];
  return [-h, ...o.cuts.filter((c) => c > -h + 0.01 && c < h - 0.01).sort((p, q) => p - q), h];
}
// how many corners and triangle corners a part makes (so the arrays are made once, at their size)
function countPart(P) {
  const { o, size } = P, skip = o.skip || '';
  if (o.poly) {
    const n = o.poly.length; let nv = n * 4, ni = n * 6;
    for (const k of ['+y', '-y']) if (!skip.includes(k)) { nv += n; ni += (n - 2) * 3; }
    return [nv, ni];
  }
  const half = size.map((x) => x / 2), long = longAxis(P);
  let nv = 0, ni = 0;
  for (const F of FACES) {
    if (skip.includes(F.key)) continue;
    const nb = stepsAlong(o, F, F.b, half, long).length, nc = stepsAlong(o, F, F.c, half, long).length;
    nv += nb * nc; ni += (nb - 1) * (nc - 1) * 6;
  }
  return [nv, ni];
}
const longAxis = ({ size, o }) => o.long ?? (size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2);

// opts (all optional): topAt(x, z) the drip edge above a spot (default: this cabin's), tintAt(x, y, z, tint) a corner's
// own tint (wood greyer up high, dirtier low down), warp(v, name) bends a finished corner (parts with o.warp)
export function buildGeometry(parts, group, R, opts = {}) {
  const top = opts.topAt || topAt, warp = opts.warp, tintAt = opts.tintAt;
  let n = 0, nIdx = 0;
  for (const P of parts) { const [a, b] = countPart(P); n += a; nIdx += b; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const lt = new Float32Array(n * 4), hf = new Float32Array(n * 4), tp = new Float32Array(n * 4), ao = new Float32Array(n);
  const partOf = new Int32Array(n), mortar = new Uint8Array(n);
  const idx = new Uint32Array(nIdx);
  const nm = new THREE.Matrix3(), axis = new THREE.Vector3(), centre = new THREE.Vector3();
  let v = 0, ii = 0;
  for (let pi = 0; pi < parts.length; pi++) {
    const P = parts[pi], { size, m, o } = P, half = size.map((x) => x / 2), skip = o.skip || '';
    const long = longAxis(P);
    nm.getNormalMatrix(m); centre.setFromMatrixPosition(m);
    axis.set(0, 0, 0).setComponent(long, 1).transformDirection(m);
    const u0 = centre.dot(axis) + (o.uShift || 0), strip = o.strip ?? 0, endTile = Math.floor(R() * WOOD.ends);
    // the rock repeats every 0.7 m; mortar and chinking read it three times finer, so whatever the rock, they come out
    // fine-grained (a granite's black grains become sand in the mortar)
    const stOff = [R() * 4, R() * 4], stM = o.mortar ? 0.7 / 3 : 0.7;
    const tint0 = o.paint || o.tint || [1, 1, 1], painted = o.paint ? 1 : 0;
    // one corner: (lx, ly, lz) where it is drawn in the part's frame; el, eh the numbers edge wear works from
    const put = (lx, ly, lz, U, V, el, eh) => {
      _v.set(lx, ly, lz).applyMatrix4(m);
      if (o.warp && warp) warp(_v, o.warp);
      pos[v * 3] = _v.x; pos[v * 3 + 1] = _v.y; pos[v * 3 + 2] = _v.z;
      nor[v * 3] = _n.x; nor[v * 3 + 1] = _n.y; nor[v * 3 + 2] = _n.z;
      uv[v * 2] = U; uv[v * 2 + 1] = V;
      lt[v * 4] = el[0]; lt[v * 4 + 1] = el[1]; lt[v * 4 + 2] = el[2]; lt[v * 4 + 3] = o.top ?? top(_v.x, _v.z);
      hf[v * 4] = eh[0]; hf[v * 4 + 1] = eh[1]; hf[v * 4 + 2] = eh[2]; hf[v * 4 + 3] = 1;
      const t = tintAt ? tintAt(_v.x, _v.y, _v.z, tint0, o) : tint0;
      tp[v * 4] = t[0]; tp[v * 4 + 1] = t[1]; tp[v * 4 + 2] = t[2]; tp[v * 4 + 3] = painted;
      partOf[v] = pi; mortar[v] = o.mortar ? 1 : 0;
      return v++;
    };
    // the end-grain squares sit in rows of four under the strips
    const perRow = WOOD.w / WOOD.endTile, ex = (endTile % perRow) * WOOD.endTile, ey = WOOD.endRow + Math.floor(endTile / perRow) * WOOD.endTile;
    const endUV = (fb, fc) => [(ex + 6 + fb * (WOOD.endTile - 12)) / WOOD.w, 1 - (ey + 6 + fc * (WOOD.endTile - 12)) / WOOD.h];
    const stripV = (f) => 1 - (strip * WOOD.strip + 0.5 + f * (WOOD.strip * (o.span || 1) - 1)) / WOOD.h;

    if (o.poly) {
      // ── a prism: its sides (each its own little face for edge wear, unless smooth: then only the ends are edges), and
      // its two ends (end grain)
      const poly = o.poly, np = poly.length, hL = half[1];
      let cx = 0, cz = 0, bx = Infinity, bz = Infinity; for (const [x, z] of poly) { cx += x / np; cz += z / np; bx = Math.min(bx, x); bz = Math.min(bz, z); }
      const cum = [0]; for (let q = 0; q < np; q++) { const [x0, z0] = poly[q], [x1, z1] = poly[(q + 1) % np]; cum.push(cum[q] + Math.hypot(x1 - x0, z1 - z0)); }
      const perim = cum[np];
      for (let q = 0; q < np; q++) {
        const [x0, z0] = poly[q], [x1, z1] = poly[(q + 1) % np], fw = Math.hypot(x1 - x0, z1 - z0);
        let fx = z1 - z0, fz = -(x1 - x0); const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
        if (fx * ((x0 + x1) / 2 - cx) + fz * ((z0 + z1) / 2 - cz) < 0) { fx = -fx; fz = -fz; }
        const b0 = v;
        for (const [t, sy] of [[0, -1], [1, -1], [1, 1], [0, 1]]) {
          const lx = x0 + (x1 - x0) * t, lz = z0 + (z1 - z0) * t, ly = sy * hL;
          if (o.smooth) { const rx = lx - cx, rz = lz - cz, rl = Math.hypot(rx, rz) || 1; _n.set(rx / rl, 0, rz / rl); } else _n.set(fx, 0, fz);
          _n.applyMatrix3(nm).normalize();
          let U = 0, V = 0;
          if (group === 'wood') { U = (u0 + ly) / WOOD.repeatM; V = stripV(o.smooth ? (cum[q] + t * fw) / perim : t); }
          else if (group === 'stone') { U = t * fw / stM + stOff[0]; V = ly / stM + stOff[1]; }
          put(lx, ly, lz, U, V, o.smooth ? [0, ly, 0] : [t * fw - fw / 2, ly, 0], o.smooth ? [1, hL, 0] : [fw / 2, hL, 0]);
        }
        // wound so the face looks out: the cross of its two sides must point along its outward normal
        const out = -(z1 - z0) * fx + (x1 - x0) * fz > 0;
        idx.set(out ? [b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3] : [b0, b0 + 3, b0 + 2, b0, b0 + 2, b0 + 1], ii); ii += 6;
      }
      for (const sy of [1, -1]) {
        if (skip.includes(sy > 0 ? '+y' : '-y')) continue;
        _n.set(0, sy, 0).applyMatrix3(nm).normalize();
        const b0 = v;
        for (const [lx, lz] of poly) {
          let U = 0, V = 0;
          if (group === 'wood') [U, V] = endUV((lx - bx) / (size[0] || 1), (lz - bz) / (size[2] || 1));
          else if (group === 'stone') { U = lx / stM + stOff[0]; V = lz / stM + stOff[1]; }
          put(lx, sy * hL, lz, U, V, [0, sy * hL, 0], [1, hL, 1]);
        }
        const [ax, az] = poly[0], [bx1, bz1] = poly[1], [cx1, cz1] = poly[2];
        const up = ((bz1 - az) * (cx1 - ax) - (bx1 - ax) * (cz1 - az)) * sy > 0;
        for (let q = 1; q < np - 1; q++) { idx.set(up ? [b0, b0 + q, b0 + q + 1] : [b0, b0 + q + 1, b0 + q], ii); ii += 3; }
      }
      continue;
    }

    // ── a box: six faces (less any it skips), each a grid of corners: one quad, or a row of them along a long log
    const local = [0, 0, 0];
    for (const F of FACES) {
      if (skip.includes(F.key)) continue;
      _n.set(0, 0, 0).setComponent(F.a, F.s).applyMatrix3(nm).normalize();
      const sb = stepsAlong(o, F, F.b, half, long), sc = stepsAlong(o, F, F.c, half, long), b0 = v, nb = sb.length;
      for (let j = 0; j < sc.length; j++) for (let i = 0; i < nb; i++) {
        local[F.a] = F.s * half[F.a]; local[F.b] = sb[i]; local[F.c] = sc[j];
        let U = 0, V = 0;
        if (group === 'wood') {
          if (F.a === long) {          // the board's end: one of the end-grain squares
            [U, V] = endUV(local[F.b] / size[F.b] + 0.5, local[F.c] / size[F.c] + 0.5);
          } else {                     // a side: along the grain is u (in metres / the strip's repeat), across is its strip
            const across = F.b === long ? F.c : F.b;
            U = (u0 + local[long]) / WOOD.repeatM;
            V = stripV(local[across] / size[across] + 0.5);
          }
        } else if (group === 'stone') {   // rock: the face's own two sides, 0.7 m to a repeat, each stone its own patch
          // (v runs up every side face, so a layered rock's beds lie level all round a stone)
          const su = F.a === 0 ? F.c : F.b, sv = F.a === 0 ? F.b : F.c;
          U = local[su] / stM + stOff[0]; V = local[sv] / stM + stOff[1];
        }
        // a sloped top (a gable board cut to the roof line): the top corners move up or down, and the edge numbers move
        // with them, so the worn edge still runs along the cut
        if (o.slope && local[1] > 0) {
          const d = o.slope * local[0];
          put(local[0], local[1] + d, local[2], U, V, [local[0], local[1] + d, local[2]], [half[0], half[1] + d, half[2]]);
        } else put(local[0], local[1], local[2], U, V, local, half);
      }
      for (let j = 0; j < sc.length - 1; j++) for (let i = 0; i < nb - 1; i++) {
        const a = b0 + j * nb + i, b = a + 1, c = a + nb + 1, d = a + nb;
        idx.set(F.s > 0 ? [a, b, c, a, c, d] : [a, d, c, a, c, b], ii); ii += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aLocalTop', new THREE.BufferAttribute(lt, 4));
  g.setAttribute('aHalf', new THREE.BufferAttribute(hf, 4)); g.setAttribute('aTintPaint', new THREE.BufferAttribute(tp, 4));
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  g.userData.partOf = partOf;   // which part each corner belongs to (the frontier cabin's contact shadows skip a part's own box)
  g.userData.mortar = mortar;   // 1 on corners of mortar and chinking (re-tinted when the rock changes, so they keep their colour)
  return g;
}

// ── the ambient-occlusion bake: how much of the sky each corner can see ──────────────────────────────────────────────
// The blocking parts (the walls' core, roof slabs, footing, chimney, porch...) are stamped into a grid of little cubes
// (voxels, 8 cm). From each vertex, 20 rays go out over the half of the sky its face looks at; each is walked out in
// steps up to 1.4 m, and a ray that runs into a filled cube (or the ground) counts as blocked, nearer hits counting more.
// AO = the share of rays that got out. It runs once at load; the shader reads it as aAO.
export class Occlusion {
  // opt: reach (how far a ray is walked, default 1.4 m) and rays (how many, default 20). The frontier cabin reaches
  // further, so a porch ceiling sees the deck under it and an eave sees the wall it hangs over. groundReach: the ground
  // only blocks a ray this close (default: any distance); the sky light already comes up dark from below, so counting
  // the ground far out would darken every wall twice.
  constructor(occ, pad = 1.6, cell = 0.08, opt = {}) {
    const box = new THREE.Box3(), b = new THREE.Box3();
    for (const O of occ) { b.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(...O.size)).applyMatrix4(O.m); box.union(b); }
    box.expandByScalar(pad); box.min.y = 0;
    this.min = box.min; this.cell = cell;
    this.nx = Math.ceil((box.max.x - box.min.x) / cell); this.ny = Math.ceil((box.max.y - box.min.y) / cell); this.nz = Math.ceil((box.max.z - box.min.z) / cell);
    this.grid = new Uint8Array(this.nx * this.ny * this.nz);
    const inv = new THREE.Matrix4(), p = new THREE.Vector3();
    for (const O of occ) {
      b.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(...O.size)).applyMatrix4(O.m); inv.copy(O.m).invert();
      const h = O.size.map((s) => s / 2 + cell * 0.35);
      const i0 = Math.max(0, Math.floor((b.min.x - this.min.x) / cell)), i1 = Math.min(this.nx - 1, Math.floor((b.max.x - this.min.x) / cell));
      const j0 = Math.max(0, Math.floor((b.min.y - this.min.y) / cell)), j1 = Math.min(this.ny - 1, Math.floor((b.max.y - this.min.y) / cell));
      const k0 = Math.max(0, Math.floor((b.min.z - this.min.z) / cell)), k1 = Math.min(this.nz - 1, Math.floor((b.max.z - this.min.z) / cell));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        p.set(this.min.x + (i + 0.5) * cell, this.min.y + (j + 0.5) * cell, this.min.z + (k + 0.5) * cell).applyMatrix4(inv);
        if (Math.abs(p.x) <= h[0] && Math.abs(p.y) <= h[1] && Math.abs(p.z) <= h[2]) this.grid[(k * this.ny + j) * this.nx + i] = 1;
      }
    }
    // ray directions: spread evenly over the upper half of a sphere, more of them near the top (as light counts)
    this.dirs = []; const N = opt.rays ?? 20, reach = opt.reach ?? 1.4;
    for (let i = 0; i < N; i++) { const t = (i + 0.5) / N, r = Math.sqrt(t), a = i * 2.39996; this.dirs.push([r * Math.cos(a), Math.sqrt(1 - t), r * Math.sin(a)]); }
    this.steps = [0.1, 0.2, 0.34, 0.52, 0.76, 1.05, 1.4].filter((x) => x <= reach + 1e-6);
    for (let x = 1.4 * 1.28; x <= reach + 0.01; x *= 1.28) this.steps.push(x);
    this.fall = 1.6 * reach / 1.4;   // a hit this far out would count for nothing
    this.groundReach = opt.groundReach ?? Infinity;
    // rain: straight down, and leaning 25 degrees four ways (wind), each walked up to 6 m
    const L = Math.sin(25 * Math.PI / 180), C = Math.cos(25 * Math.PI / 180);
    this.rainDirs = [[0, 1, 0], [L, C, 0], [-L, C, 0], [0, C, L], [0, C, -L]];
    this.rainSteps = []; for (let s = 0.1; s < 6; s += 0.07) this.rainSteps.push(s);   // fine steps: a roof slab is thin
  }
  filled(x, y, z) {
    if (y < 0) return true;
    const i = Math.floor((x - this.min.x) / this.cell), j = Math.floor((y - this.min.y) / this.cell), k = Math.floor((z - this.min.z) / this.cell);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return false;
    return this.grid[(k * this.ny + j) * this.nx + i] === 1;
  }
  at(px, py, pz, nx, ny, nz, start = 0.06) {
    // a frame round the normal: t, b, n
    let tx, ty, tz; if (Math.abs(ny) < 0.9) { tx = nz; ty = 0; tz = -nx; } else { tx = 1; ty = 0; tz = 0; }
    let l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    const ox = px + nx * start, oy = py + ny * start, oz = pz + nz * start;
    let blocked = 0;
    for (const [dx, dy, dz] of this.dirs) {
      const wx = tx * dx + nx * dy + bx * dz, wy = ty * dx + ny * dy + by * dz, wz = tz * dx + nz * dy + bz * dz;
      for (const s of this.steps) {
        const y = oy + wy * s;
        if (y < 0) { if (s <= this.groundReach) blocked += 1 - (s / this.fall) * 0.75; break; }
        if (this.filled(ox + wx * s, y, oz + wz * s)) { blocked += 1 - (s / this.fall) * 0.75; break; }
      }
    }
    return 1 - blocked / this.dirs.length;
  }
  // the share of rain rays (from the sky down to this spot) that nothing stops
  rain(px, py, pz, nx, ny, nz) {
    const ox = px + nx * 0.06, oy = py + ny * 0.06, oz = pz + nz * 0.06;
    let open = 0;
    for (const [dx, dy, dz] of this.rainDirs) {
      if (dx * nx + dy * ny + dz * nz < -0.05) continue;   // rain can't come from behind the face
      let hit = false; for (const s of this.rainSteps) if (this.filled(ox + dx * s, oy + dy * s, oz + dz * s)) { hit = true; break; }
      if (!hit) open++;
    }
    return open / this.rainDirs.length;
  }
  bake(geo) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, A = geo.attributes.aAO.array, H = geo.attributes.aHalf.array;
    for (let i = 0; i < A.length; i++) {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
      A[i] = this.at(...p); H[i * 4 + 3] = this.rain(...p);
    }
    geo.attributes.aAO.needsUpdate = true; geo.attributes.aHalf.needsUpdate = true;
  }
}

// ── build it all ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildCabin(seed = 11) {
  const t0 = performance.now(), k = new Kit(seed);
  footing(k); walls(k); roofs(k); porch(k); chimney(k); extras(k);
  const R = rng(seed + 1), geos = {};
  for (const g in k.parts) geos[g] = buildGeometry(k.parts[g], g, R);
  const t1 = performance.now();
  const occ = new Occlusion(k.occ);
  for (const g in geos) occ.bake(geos[g]);
  const counts = {}; for (const g in k.parts) counts[g] = k.parts[g].length;
  return { geos, occ, counts, parts: Object.values(counts).reduce((a, b) => a + b, 0), msBuild: t1 - t0, msAO: performance.now() - t1 };
}
