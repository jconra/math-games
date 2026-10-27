// THE BUILDING LAB'S SHARED PARTS: what any of the town's buildings is made from, on top of the Material Lab's parts kit
// (labs/materials/cabin.js: a Kit of boxes merged into one mesh per material, and the baked shading). The stable is the
// first building that uses them (stable.js); the general store and the sheriff's office can be built from the same.
//
//   wall frames       every wall in its own frame: x along it (to the right, seen from outside), y up, z out of it
//   boardAndBatten    upright boards side by side, a narrow batten over each joint, cut round the openings; painted on
//                     the outside only (each board is two skins: the outside one painted, the inside one bare)
//   casing            the trim round a door or window opening
//   roofSlope         a roof slope: the boards under it (seen from inside and under the eaves), rafters, split shakes in
//                     courses, barge boards, a ridge cap
//   doorLeaf          a plank door on its battens (Z-braced), built round its own hinge so it can swing
//   lantern           an iron lantern (its glass and flame go to the glow mesh), on a bracket or hanging
//   Light             the baked light: how much sky each corner sees (near: the voxel bake; inside: only what comes in
//                     through the doors and windows), and how much each lantern lights it
//   lit, boardWear, glowMaterial, animalLamps   the shader patches that read those numbers; lanternGlow, a glow sprite
//                     round each lantern; setLamps, where the lanterns are (the shaders work their light out per pixel)
//
// Everything stays WebGL1-safe: texture2D, no array constructors (uniform arrays are fine), loops with fixed bounds.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WOOD } from '../materials/textures.js';

// ── matrices ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
export const RX = (a) => new THREE.Matrix4().makeRotationX(a);
export const RY = (a) => new THREE.Matrix4().makeRotationY(a);
export const RZ = (a) => new THREE.Matrix4().makeRotationZ(a);
export const mul = (m, ...more) => { const r = m.clone(); for (const x of more) r.multiply(x); return r; };
const ONE = new THREE.Vector3(1, 1, 1), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export const smooth01 = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// a tint a little lighter or darker: one number for all three channels (one each would change its hue)
export const vary = (k, t, a, b) => { const l = k.r(a, b); return t.map((c) => c * l); };
// an n-sided outline round the middle (for prisms: poles, pegs, a lantern's cap)
export const ngon = (n, r, jit = 0, R = () => 0.5) => Array.from({ length: n }, (_, i) => { const a = (i + 0.5) / n * Math.PI * 2, rr = r * (1 + (R() - 0.5) * jit); return [Math.cos(a) * rr, Math.sin(a) * rr]; });

// ── wall frames ──────────────────────────────────────────────────────────────────────────────────────────────────────
// th: the wall's turn about y (0: it faces +z), d: how far out its outside face stands from (ox, oz)
export const wallOf = (th, d, ox = 0, oz = 0) => ({ th, d, ox, oz });
export function wallM(w, a, y, out = 0, rot = null) {
  return T(w.ox, 0, w.oz).multiply(RY(w.th)).multiply(new THREE.Matrix4().compose(new THREE.Vector3(a, y, w.d + out), _q.setFromEuler(_e.set(...(rot || [0, 0, 0]), 'YXZ')), ONE));
}
// a point in a wall's frame, in the building's
export function wallP(w, a, y, out = 0) { const v = new THREE.Vector3(a, y, w.d + out).applyMatrix4(RY(w.th)); return [v.x + w.ox, v.y, v.z + w.oz]; }

// ── board and batten ─────────────────────────────────────────────────────────────────────────────────────────────────
// o: a0, a1 (the run along the wall), y0 (the boards' foot), top(a) (their top: a level eave, or a gable's roof line),
//    apex (a gable's peak: a board never spans it, its top would need two slopes), opens [{ a0, a1, y0, y1 }],
//    paint (the outside's colour, or null), tint (the bare wood's), inTint (the inside's; null: no inside faces),
//    rows (heights where each board gets a row of corners, so the baked light can change along it), bt (thickness),
//    solid (false: no light-blocking core: the ends of a lean-to), batten (false: none), bare (a share of boards that
//    were replaced and never painted), bottom(b0, b1) (each board's own foot, instead of y0: a cupola's boards follow
//    the roof under them)
export function boardAndBatten(k, w, o) {
  const bt = o.bt ?? 0.025, top = o.top, rows = o.rows || [];
  const cuts = [o.a0, o.a1, ...(o.apex !== undefined ? [o.apex] : [])];
  for (const op of o.opens || []) cuts.push(Math.max(o.a0, Math.min(o.a1, op.a0)), Math.max(o.a0, Math.min(o.a1, op.a1)));
  const bp = [...new Set(cuts.map((x) => Math.round(x * 1e4) / 1e4))].sort((a, b) => a - b);
  // a piece's vertical stretch, less any opening that spans it
  const spansOf = (b0, b1) => {
    const ac = (b0 + b1) / 2; let spans = [[o.bottom ? o.bottom(b0, b1) : o.y0, top(ac), true]];
    for (const op of o.opens || []) if (op.a0 <= b0 + 1e-4 && op.a1 >= b1 - 1e-4) spans = spans.flatMap(([s, e, t]) => (op.y1 <= s || op.y0 >= e ? [[s, e, t]] : [[s, op.y0, false], [op.y1, e, t]].filter(([p, q]) => q - p > 0.06)));
    return spans;
  };
  const piece = (b0, b1, kind) => {
    const bw = b1 - b0, ac = (b0 + b1) / 2, slope = (top(b1) - top(b0)) / bw;
    for (const [ya, yb, isTop] of spansOf(b0, b1)) {
      const h = yb - ya, yc = (ya + yb) / 2, sl = isTop ? slope : 0;
      const cl = rows.filter((y) => y > ya + 0.25 && y < yb - 0.25).map((y) => y - yc);
      if (kind === 'board') {
        const bare = o.paint && k.R() < (o.bare ?? 0.05), paint = o.paint && !bare ? vary(k, o.paint, 0.9, 1.08) : null;
        const hue = k.r(-0.05, 0.05), t0 = bare ? o.tint.map((c) => c * 1.12) : o.tint;
        const tint = vary(k, [t0[0] * (1 + hue), t0[1], t0[2] * (1 - hue)], 0.8, 1.18), strip = Math.floor(k.R() * 12), uShift = k.r(0, 1.2);
        // (half of them turned round on their long axis: the strip's picture mirrored across the board, so neighbouring
        // boards don't show the same knots in the same places)
        const flip = k.R() < 0.5, mo = flip ? mul(wallM(w, ac, yc, -bt / 2), RY(Math.PI)) : wallM(w, ac, yc, -bt / 2);
        k.board([bw + 0.002, h, bt], null, null, { m: mo, long: 1, tint, paint, strip, uShift, skip: (flip ? '+z' : '-z') + '+x-x+y-y', cuts: cl, segFaces: flip ? '-z' : '+z', slope: flip ? -sl : sl, outside: true, nail: 1 });
        if (o.inTint) k.board([bw + 0.002, h, bt], null, null, { m: wallM(w, ac, yc, -bt / 2), long: 1, tint: vary(k, o.inTint, 0.85, 1.12), strip, uShift, skip: '+z+x-x+y-y', cuts: cl, segFaces: '-z', slope: sl, inside: true });
        if (o.solid !== false) k.solid([bw, h, 0.06], null, null, wallM(w, ac, yc, -bt / 2));
      } else {
        const paint = o.paint ? vary(k, o.paint, 0.92, 1.06) : null;
        k.board([bw, h - 0.01, 0.02], null, null, { m: wallM(w, ac, yc - 0.005, 0.01), long: 1, tint: vary(k, o.tint, 0.85, 1.05), paint, uShift: k.r(0, 1.2), skip: '-z+y-y', cuts: cl, segFaces: '+z', slope: sl, outside: true, nail: 0.5 });
      }
    }
  };
  for (let s = 0; s < bp.length - 1; s++) {
    const A = bp[s], B = bp[s + 1]; if (B - A < 0.02) continue;
    // the boards across this stretch: 22 to 32 cm each, the last one taking what is left (never a sliver)
    const edges = [A];
    let x = A;
    while (B - x > 0.4) { x += k.r(0.25, 0.35); edges.push(x); }
    edges.push(B);
    if (edges.length > 2 && B - edges[edges.length - 2] < 0.12) edges.splice(edges.length - 2, 1);
    for (let i = 0; i < edges.length - 1; i++) piece(edges[i], edges[i + 1], 'board');
    if (o.batten !== false) for (let i = 1; i < edges.length - 1; i++) piece(edges[i] - 0.0325, edges[i] + 0.0325, 'batten');
  }
}

// the trim round an opening (in the wall's frame): a board up each side, a head board with a drip cap over it, for a
// window a sill that sticks out and an apron under it. Over the battens (they stand 2 cm proud), so 3 cm thick
export function casing(k, w, op, o = {}) {
  const tint = o.tint, cw = o.width ?? 0.11, out = 0.02, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, wd = op.a1 - op.a0;
  const y0 = op.door ? op.y0 : op.y0 - 0.02;
  for (const [a, s] of [[op.a0, -1], [op.a1, 1]]) k.board([cw, op.y1 - y0 + cw, 0.03], null, null, { m: wallM(w, a + s * cw / 2, (y0 + op.y1 + cw) / 2, out + 0.015), long: 1, tint: vary(k, tint, 0.9, 1.08), skip: '-z' + (op.door ? '-y' : ''), outside: true });
  k.board([wd + 2 * cw + 0.06, 0.13, 0.032], null, null, { m: wallM(w, ac, op.y1 + cw + 0.065, out + 0.016), long: 0, tint: vary(k, tint, 0.9, 1.08), skip: '-z', outside: true });
  k.board([wd + 2 * cw + 0.14, 0.035, 0.07], null, null, { m: wallM(w, ac, op.y1 + cw + 0.145, out + 0.035, [0.04, 0, 0]), long: 0, tint: vary(k, tint, 0.9, 1.08), outside: true });
  if (!op.door) {
    k.board([wd + 2 * cw + 0.12, 0.045, 0.13], null, null, { m: wallM(w, ac, op.y0 - 0.04, out + 0.04, [0.08, 0, 0]), long: 0, tint: vary(k, tint, 0.9, 1.08), outside: true });
    k.board([wd + 2 * cw - 0.02, 0.1, 0.025], null, null, { m: wallM(w, ac, op.y0 - 0.12, out + 0.0125), long: 0, tint: vary(k, tint, 0.9, 1.08), skip: '-z', outside: true });
  }
  // the reveal: boards lining the opening's sides and top, from the outside trim back through the wall
  const dep = o.depth ?? 0.12;
  for (const [a, s] of [[op.a0, 1], [op.a1, -1]]) k.board([0.025, h, dep], null, null, { m: wallM(w, a - s * 0.0125, (op.y0 + op.y1) / 2, out + 0.03 - dep / 2), long: 1, tint: vary(k, tint, 0.8, 0.95), skip: '-y+y' });
  k.board([wd, 0.025, dep], null, null, { m: wallM(w, ac, op.y1 + 0.0125, out + 0.03 - dep / 2), long: 0, tint: vary(k, tint, 0.8, 0.95), skip: '+y' });
}

// ── a roof slope ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Built in its own frame (its top edge along x at height topY, z = 0, running down toward +z) and moved into place by M.
// o: x0, x1 (along the top edge), topY, len (along the slope), pitch, shakeT (tint), boardT (the boards under it),
//    rafterT, every (rafter spacing), hole(x, z) (in the building's frame: no shakes there, a cupola stands on them),
//    barge (barge boards at both ends), cap (a ridge cap board on this slope's top edge), comb (its top course runs on
//    past the peak), rows (spacing of rows of corners along the boards, for the baked light), noSolid
const _v3 = new THREE.Vector3();
export function roofSlope(k, M, o) {
  const { x0, x1, topY, len, pitch } = o;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const up = new THREE.Vector3(0, sp, -cp), nrm = new THREE.Vector3(0, cp, sp);
  const eave = new THREE.Vector3(0, topY - len * sp, len * cp);
  const at = (x, s, n) => eave.clone().addScaledVector(up, s).addScaledVector(nrm, n).setX(x);
  const Rp = RX(pitch);
  const frame = (x, s, n, extra) => { const m = mul(M, T(...at(x, s, n).toArray()), Rp); if (extra) m.multiply(extra); return m; };
  const wood = (size, x, s, n, extra, opt) => k.board(size, null, null, { ...opt, m: frame(x, s, n, extra) });
  const rowStep = o.rows ?? 1.4, xc = (a, b) => { const out = []; for (let x = a + rowStep; x < b - 0.3; x += rowStep) out.push(x - (a + b) / 2); return out; };
  // the boards under the shakes: wide boards across the slope, only their undersides drawn (inside, and under the eaves)
  for (let s = 0; s < len - 0.01;) {
    const ds = Math.min(k.r(0.26, 0.34), len - s), j = k.r(-1.2, 1.2), mid = (x0 + x1) / 2 + j;
    for (const [a, b] of [[x0, mid], [mid, x1]]) wood([b - a + 0.006, 0.022, ds + 0.008], (a + b) / 2, s + ds / 2, -0.011, null, { long: 0, tint: vary(k, o.boardT, 0.86, 1.12), skip: '+y+x-x+z-z', cuts: xc(a, b), segFaces: '-y', inside: o.interior });
    s += ds;
  }
  if (!o.noSolid) for (let q = 0; q < 4; q++) { const a = x0 + (x1 - x0) * q / 4, b = a + (x1 - x0) / 4; k.solid([b - a, 0.12, len], null, null, frame((a + b) / 2, len / 2, -0.06)); }
  // rafters: every 60 cm, their tails showing under the eave
  const every = o.every ?? 0.6, n = Math.max(2, Math.round((x1 - x0 - 0.24) / every));
  for (let i = 0; i <= n; i++) {
    const x = x0 + 0.12 + (x1 - x0 - 0.24) * i / n;
    if (o.skipRafter && o.skipRafter(x)) continue;
    const L = len - 0.02, rc = []; for (let z = -L / 2 + 2.2; z < L / 2 - 0.4; z += 2.2) rc.push(z);
    wood([0.06, 0.15, L], x, L / 2 + 0.02, -0.022 - 0.075, null, { long: 2, tint: vary(k, o.rafterT, 0.9, 1.1), strip: 10 + (i % 2), skip: '+y-z', cuts: rc, segFaces: '-y+x-x', ends: 'log' });
  }
  // the starter strip at the eave (the first course rests its butts on it; it gives the eave its thick edge)
  // (thin, and the first course lifted onto it: thicker than the shakes' own lift, it stood up through them)
  for (const [a, b] of [[x0 - 0.04, (x0 + x1) / 2 - 1.3], [(x0 + x1) / 2 - 1.3, (x0 + x1) / 2 + 1.1], [(x0 + x1) / 2 + 1.1, x1 + 0.04]]) wood([b - a, 0.026, 0.2], (a + b) / 2, 0.1, 0.013, null, { long: 0, tint: o.shakeT.map((c) => c * 0.62), strip: WOOD.shake, skip: '-z' });
  // the shakes: split shakes in level courses, each course resting its butts on the one below (so it tilts up a little,
  // and its butt throws the dark line under each course); a joint never right over one in the course below; most boxes
  // are two shakes side by side (they span both shake strips, whose dark edges draw the gap between them). Drawn: the
  // top and the butt (the rest is under or between other shakes). Lower courses darker (the water runs off there).
  let s = -0.06, row = 0, below = [];
  while (s < len - 0.1) {
    const e = k.r(0.41, 0.45), joints = [], last = s + e >= len - 0.12;
    let x = x0 - 0.04, first = true;
    while (x < x1 + 0.04) {
      const pair = !first && k.R() < 0.88;
      let wdt = first ? k.r(0.12, 0.26) : pair ? k.r(0.42, 0.62) : k.r(0.2, 0.3);
      first = false;
      for (const j of below) if (Math.abs(x + wdt - j) < 0.035) wdt += 0.05;
      wdt = Math.min(wdt, x1 + 0.06 - x); if (wdt < 0.05) break;
      const gap = k.R() < 0.04 ? k.r(0.02, 0.03) : k.r(0.004, 0.012);
      const th = k.r(0.025, 0.035), dL = k.r(-0.02, 0.02), L = last && o.comb ? len - s + dL + 0.08 : Math.min(e * 2.3, len - s + 0.03) + dL, lift = 0.5 * th / e, cx = x + (wdt - gap) / 2;
      const ctr = _v3.copy(at(cx, s - dL + L / 2, 0)).applyMatrix4(M);
      if (!(o.hole && o.hole(ctr.x, ctr.z))) {
        const extra = mul(RY(k.r(-0.016, 0.016)), RX(-lift));
        const m = frame(cx, s - dL + L / 2, th / 2 + 0.002 + (L / 2) * Math.sin(lift) + (row === 0 ? 0.027 : 0), extra);
        const r = k.R(), g = k.r(0.9, 1.1), low = 0.78 + 0.22 * smooth01(s, 0, len * 0.6);
        const tint = (r < 1 / 6 ? [0.84, 0.82, 0.8] : r < 0.25 ? [1.14, 1.16, 1.18] : [1, 1, 1]).map((c, i) => c * g * low * o.shakeT[i]);
        k.board([wdt - gap, th, L], null, null, { m, long: 2, strip: pair ? WOOD.shake : WOOD.shake + Math.floor(k.R() * 2), span: pair ? 2 : 1, tint, uShift: k.r(0, 1.2), shakeE: e + dL, skip: row === 0 || (last && o.comb) ? '-z+x-x' : '-y-z+x-x', roof: true });
      }
      joints.push(x + wdt); x += wdt;
    }
    below = joints; s += e; row++;
  }
  // barge boards along the gable edges, a little below the shakes (they hang a few cm past it)
  if (o.barge) for (const x of [x0 + 0.03, x1 - 0.03]) wood([0.05, 0.2, len + 0.03], x, len / 2 - 0.01, -0.085, null, { long: 2, tint: vary(k, o.bargeT || o.rafterT, 0.9, 1.05), strip: 10, outside: true });
  // a ridge cap: a board along the top edge, lying on the shakes
  if (o.cap) for (const [a, b] of [[x0 + 0.06, (x0 + x1) / 2 - 0.9], [(x0 + x1) / 2 - 0.9, (x0 + x1) / 2 + 1.6], [(x0 + x1) / 2 + 1.6, x1 - 0.06]]) wood([b - a - 0.004, 0.028, 0.17], (a + b) / 2, len - 0.075, 0.068, null, { long: 0, tint: vary(k, o.shakeT, 0.7, 0.8), strip: 11, skip: '-y', roof: true });
  return { at: (x, s, nn) => at(x, s, nn).applyMatrix4(M) };
}

// ── a plank door ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Built in its own frame round its hinge: the hinge line is the y axis, the leaf runs from x = 0 to side * w, its middle
// at z = 0 (its outside face toward +z). Planks on rails, a Z of braces between the rails on both faces, strap hinges
// (painted iron-black). o: w, h, side (+1, -1), tint, strap (the hinges' paint), rails (heights), xBrace (an X between
// two rails instead of a Z), harness (a collar and straps hung on the inside face)
export function doorLeaf(k, o) {
  const { w, h, side } = o, pt = 0.045, np = Math.max(3, Math.round(w / 0.2)), pw = w / np;
  const rails = o.rails || [0.28, h / 2, h - 0.28];
  for (let i = 0; i < np; i++) {
    const xc = side * (i + 0.5) * pw, free = i === np - 1, tint = vary(k, o.tint, 0.85, 1.12);
    const skip = (free ? (side > 0 ? '-x' : '+x') : '+x-x');
    k.board([pw - 0.003, h - k.r(0, 0.02), pt], [xc, h / 2, 0], [0, 0, k.r(-0.003, 0.003)], { long: 1, tint, skip, cuts: o.cuts || [0], segFaces: '+z-z' });
  }
  const iw = w - 0.06, rc = side * w / 2;
  for (const sgn of [1, -1]) {
    const z = sgn * (pt / 2 + 0.0175);
    for (const y of rails) k.board([iw, 0.15, 0.035], [rc, y, z], null, { long: 0, tint: vary(k, o.tint, 0.85, 1.0), skip: sgn > 0 ? '-z' : '+z' });
    // the braces between the rails: a Z (each runs up from the hinge side's low corner to the free side), or an X
    for (let r = 0; r < rails.length - 1; r++) {
      const ya = rails[r] + 0.075, yb = rails[r + 1] - 0.075, dx = iw - 0.16, dy = yb - ya, ang = Math.atan2(dy, dx), sa = Math.sin(ang), ca = Math.cos(ang);
      // (no longer than the panel lets it be, its 13 cm width and all: a short gate's shallow brace stuck out past its edge)
      const L = Math.min(Math.hypot(dx, dy) - 0.06, (dx - 0.13 * sa) / ca - 0.02, sa > 0.05 ? (dy - 0.13 * ca) / sa - 0.02 : 9);
      const list = o.xBrace ? [ang, -ang] : [ang];
      for (const a of list) k.board([L, 0.13, 0.035], [rc, (ya + yb) / 2, z], [0, 0, side * a], { long: 0, tint: vary(k, o.tint, 0.85, 1.0), skip: sgn > 0 ? '-z' : '+z' });
    }
  }
  // strap hinges on the outside face, from the hinge most of the way across
  if (o.strap !== false) for (const y of [rails[0], rails[rails.length - 1]]) {
    k.board([w * 0.62, 0.05, 0.01], [side * w * 0.31, y, pt / 2 + 0.04], null, { long: 0, tint: [0.4, 0.38, 0.36], paint: o.strap || [0.035, 0.032, 0.03], skip: '-z' });
    k.board([0.05, 0.09, 0.03], [side * 0.03, y, pt / 2 + 0.03], null, { long: 1, tint: [0.4, 0.38, 0.36], paint: o.strap || [0.035, 0.032, 0.03], skip: '-z' });
  }
  if (o.handle) k.board([0.03, 0.3, 0.03], [side * (w - 0.18), h * 0.48, pt / 2 + 0.055], null, { long: 1, paint: [0.04, 0.035, 0.03], tint: [0.4, 0.38, 0.36] });
  if (o.harness) harness(k, side * w * 0.48, h * 0.6, -(pt / 2 + 0.035 + 0.02), -1, o.harness);
}
// a work harness hung on a peg: the collar (a ring of short pieces, taller than wide), the hames along it, straps and
// traces hanging down with iron rings. at x, y on a face looking toward `face` (+1: +z, -1: -z)
export function harness(k, x, y, z, face, o = {}) {
  const leather = o.leather || [0.24, 0.13, 0.07], brass = [0.62, 0.45, 0.18], f = face;
  k.board([0.05, 0.05, 0.12], [x, y + 0.06, z - f * 0.03], null, { long: 2, tint: [0.9, 0.85, 0.8] });   // the peg
  // the collar: a padded leather ring, taller than wide (a tube, when the kit has a rope list; else short pieces)
  const n = 12, rx = 0.2, ry = 0.29;
  if (k.parts.rope) {
    const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push(new THREE.Vector3(x + Math.cos(a) * rx, y - ry + Math.sin(a) * ry, z + f * 0.045)); }
    k.parts.rope.push({ pts, closed: true, rad: 0.04, sides: 8, tint: [0.42, 0.24, 0.16] });
  } else for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2, a2 = (i + 1.5) / n * Math.PI * 2;
    const px = x + Math.cos(a) * rx, py = y - ry + Math.sin(a) * ry, qx = x + Math.cos(a2) * rx, qy = y - ry + Math.sin(a2) * ry;
    const L = Math.hypot(qx - px, qy - py) + 0.03, ang = Math.atan2(qy - py, qx - px);
    k.board([L, 0.075, 0.07], [(px + qx) / 2, (py + qy) / 2, z + f * 0.035], [0, 0, ang], { long: 0, paint: leather.map((c) => c * k.r(0.9, 1.1)), tint: [0.5, 0.4, 0.3] });
  }
  for (const s of [-1, 1]) k.board([0.03, 0.62, 0.035], [x + s * (rx + 0.02), y - ry, z + f * 0.08], [0, 0, s * 0.08], { long: 1, paint: brass, tint: [0.8, 0.7, 0.5] });
  for (const [dx, len] of [[-0.12, 0.85], [0.0, 1.05], [0.13, 0.75]]) {
    k.board([0.045, len, 0.012], [x + dx, y - 2 * ry - len / 2 + 0.06, z + f * 0.02], [0, 0, dx * 0.15], { long: 1, paint: leather.map((c) => c * k.r(0.85, 1.05)), tint: [0.5, 0.4, 0.3] });
    k.board([0.07, 0.07, 0.014], [x + dx, y - 2 * ry - len + 0.1, z + f * 0.03], null, { long: 0, paint: [0.05, 0.045, 0.04], tint: [0.5, 0.5, 0.5] });
  }
}

// ── lanterns ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// an iron lantern at (x, y, z) (the middle of its glass): base, cap, four corner rods, a bail handle; the glass and the
// flame are glow parts. o.bracket [dx, dz]: an iron arm from the post or wall it hangs from (that way from the
// lantern, metres); o.chain: hangs from a chain this long. Returns the lantern's light: { p, reach, strength }
export const GLOW = { window: 1, glass: 2, flame: 3, inPane: 4 };
export function lantern(k, x, y, z, o = {}) {
  const iron = [0.85, 0.8, 0.76];
  k.box('iron', [0.15, 0.025, 0.15], [x, y - 0.11, z], null, { tint: iron });
  k.prism('iron', ngon(6, 0.1), 0.06, [x, y + 0.115, z], null, { tint: iron, taper: 0.55, smooth: true });
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box('iron', [0.014, 0.2, 0.014], [x + dx * 0.062, y, z + dz * 0.062], null, { tint: iron, skip: '+y-y' });
  // the bail: a wire loop over the cap (a thin tube, when the kit has a rope list), on a short stem
  k.box('iron', [0.014, 0.05, 0.014], [x, y + 0.165, z], null, { tint: iron });
  if (k.parts.rope) {
    const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; pts.push(new THREE.Vector3(x + Math.cos(a) * 0.065, y + 0.16 + Math.sin(a) * 0.09, z)); }
    k.parts.rope.push({ pts, closed: false, rad: 0.0045, sides: 4, tint: [0.12, 0.11, 0.1] });
  } else k.box('iron', [0.07, 0.012, 0.012], [x, y + 0.225, z], null, { tint: iron });
  // the glass (see-through, glowing: GLOW.glass parts are drawn as panes of light over what's behind), the flame in it
  k.parts.glow.push({ size: [0.11, 0.18, 0.11], m: T(x, y, z), kind: GLOW.glass, col: [0.85, 0.32, 0.07] });
  k.parts.glow.push({ size: [0.02, 0.06, 0.02], m: T(x, y - 0.025, z), kind: GLOW.flame, col: [9, 5.4, 1.6] });
  k.parts.glow.push({ size: [0.045, 0.03, 0.045], m: T(x, y - 0.07, z), kind: GLOW.flame, col: [0.5, 0.36, 0.2] });   // the wick's brass burner
  if (o.bracket) {
    const [dx, dz] = o.bracket, L = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
    k.box('iron', [0.025, 0.025, L], [x + dx / 2, y + 0.26, z + dz / 2], [0, a, 0], { tint: iron });
    const sL = Math.hypot(L * 0.6, 0.3), sa = Math.atan2(0.3, L * 0.6);
    k.box('iron', [0.018, 0.018, sL], [x + dx * 0.7, y + 0.11, z + dz * 0.7], [-sa, a, 0], { tint: iron });   // the strut under it
    k.box('iron', [0.012, 0.035, 0.012], [x, y + 0.24, z], null, { tint: iron });
    k.box('iron', [0.06, 0.12, 0.02], [x + dx, y + 0.2, z + dz], [0, a, 0], { tint: iron });                     // the plate it's screwed on by
  }
  if (o.chain) k.box('iron', [0.014, o.chain, 0.014], [x, y + 0.23 + o.chain / 2, z], null, { tint: iron, skip: '+y-y' });
  return { p: [x, y, z], reach: o.reach ?? 6.5, strength: o.strength ?? 1 };
}
// the glow parts as one mesh: boxes, each corner carrying its colour when lit (rgb, brighter than white: it glows) and
// what it is (a: 1 a window pane, 2 lantern glass, 3 a flame)
export function glowGeometry(parts, keep = () => true) {
  parts = parts.filter(keep);
  if (!parts.length) return null;
  const list = parts.map((P) => {
    const g = P.pane ? new THREE.PlaneGeometry(P.size[0], P.size[1]) : new THREE.BoxGeometry(...P.size); g.applyMatrix4(P.m); g.deleteAttribute('uv');
    const n = g.attributes.position.count, c = new Float32Array(n * 4), ctr = new Float32Array(n * 4), m = new THREE.Vector3().setFromMatrixPosition(P.m);
    for (let i = 0; i < n; i++) { c.set([...P.col, P.kind], i * 4); ctr.set([m.x, m.y - 0.03, m.z, Math.max(...P.size) / 2], i * 4); }
    g.setAttribute('aGlow', new THREE.BufferAttribute(c, 4)); g.setAttribute('aGlowC', new THREE.BufferAttribute(ctr, 4));
    return g;
  });
  return mergeGeometries(list);
}

// ── rope ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Rope as real tubes (8 sides) along curves, the twist drawn into its own small picture (ropeTexture), so a coil reads
// as rope and not as a ring of sticks. ropeCoil adds a hung coil's curves to a list (loops a little apart and askew, a
// tail hanging below); ropeGeometry turns a list into one mesh: per corner u along the rope (one twist every 5 cm), the
// part's tint in aTintPaint (rope or leather)
export function ropeCoil(list, c, n, o = {}) {
  const up = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3(...n).normalize(), U = new THREE.Vector3().crossVectors(up, N).normalize(), C = new THREE.Vector3(...c);
  const r = o.r ?? 0.15, loops = o.loops ?? 3, tint = o.tint || [1, 1, 1], rad = o.rad ?? 0.011;
  for (let k = 0; k < loops; k++) {
    const pts = [], dx = (k - (loops - 1) / 2) * 0.025, dn = 0.02 + k * 0.022, rr = r * (1 - 0.06 * k), tilt = (k - 1) * 0.12;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, x = Math.cos(a) * rr + dx + Math.sin(a) * tilt * 0.1, y = Math.sin(a) * rr * 1.25 - rr * 1.2;   // (hanging from the peg at its top)
      pts.push(C.clone().addScaledVector(U, x).addScaledVector(up, y).addScaledVector(N, dn + 0.01 * Math.sin(a * 2 + k)));
    }
    list.push({ pts, closed: true, rad, tint });
  }
  // the end, hanging down out of the bottom of the coil
  const b = C.clone().addScaledVector(up, -r * 2.4).addScaledVector(U, r * 0.35).addScaledVector(N, 0.04);
  list.push({ pts: [b.clone().addScaledVector(up, 0.12), b, b.clone().addScaledVector(up, -0.16).addScaledVector(U, 0.03), b.clone().addScaledVector(up, -0.3).addScaledVector(U, 0.02)], closed: false, rad, tint });
}
export function ropeGeometry(list) {
  if (!list.length) return null;
  const geos = list.map((R) => {
    const curve = new THREE.CatmullRomCurve3(R.pts, R.closed, 'centripetal'), L = curve.getLength();
    const g = new THREE.TubeGeometry(curve, R.closed ? 14 : 6, R.rad, R.sides ?? 6, R.closed);
    const uv = g.attributes.uv, tp = new Float32Array(uv.count * 4);
    for (let i = 0; i < uv.count; i++) { uv.setX(i, uv.getX(i) * L / 0.05); tp.set([...R.tint, 0], i * 4); }
    g.setAttribute('aTintPaint', new THREE.BufferAttribute(tp, 4));
    return g;
  });
  const out = mergeGeometries(geos); for (const g of geos) g.dispose();
  return out;
}
export function ropeTexture() {
  const W = 64, H = 32, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  // three strands twisted round: stripes at a slant (u along the rope, v round it), dark in the grooves between them
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (x / W + y / H * 3) % 1, f = (t * 3) % 1, ridge = Math.sin(f * Math.PI), fib = 0.92 + 0.08 * Math.sin(x * 2.1 + y * 5.3);
    const l = (0.38 + 0.62 * Math.pow(ridge, 0.6)) * fib, i = (y * W + x) * 4;
    img.data[i] = 196 * l; img.data[i + 1] = 166 * l; img.data[i + 2] = 118 * l; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// ── the baked light ──────────────────────────────────────────────────────────────────────────────────────────────────
// For every corner, three numbers, worked out once when the building is built:
//   near    how much of the sky it sees close by (the Material Lab's voxel bake: corners, under eaves, behind things)
//   inside  only for corners inside the building: how much of the outside it sees through the doors and windows (each
//           opening's share of its view, as a "form factor": its area, how squarely each faces the other, over the
//           distance squared; a few rays through the voxels to each, so a stall's partition shades the stall behind)
//           kept as two parts, through the front doors and through everything else, so the doors can shut
//   lamp    how much each lantern lights it: facing it, closer is brighter (falling off with the distance squared and
//           gone by the lantern's reach), nothing behind a wall (rays through the voxels again)
// And, if the building gives one, a warm FILL: lantern light that has bounced about inside a stall, no direction, no
// shadows (o.fill(x, y, z, nx, ny, nz) -> how much), so a stall isn't a black box.
// apply(geo, doorsOpen) turns them into aAO (sky light, darkened) and aLamp (x: the share of the lanterns' light that
// isn't blocked: the shader works the light itself out per pixel, so each lantern throws a round pool; y: the fill).
export class Light {
  // occ: an Occlusion (cabin.js) with the building's solids; o: inside(x, y, z) -> is this point indoors; openings
  // [{ c, u, v, n, front }] (middle, half-width and half-height vectors, the outward normal); lamps [{ p, reach, strength }]
  constructor(occ, o) {
    Object.assign(this, { occ, inside: o.inside, fill: o.fill || null, openings: o.openings || [], lamps: o.lamps || [], base: o.base ?? 0.1, gain: o.gain ?? 2.6, out: o.out ?? [0.35, 0.65], bounce: o.bounce ?? 0.15, floor: o.floor ?? 0.1 });
    // each opening's sample points (3 x 3 over its inner part) and their share of its area
    for (const op of this.openings) {
      op.pts = []; const A = 4 * Math.hypot(...op.u) * Math.hypot(...op.v);
      for (const fu of [-0.6, 0, 0.6]) for (const fv of [-0.6, 0, 0.6]) op.pts.push([op.c[0] + op.u[0] * fu + op.v[0] * fv, op.c[1] + op.u[1] * fu + op.v[1] * fv, op.c[2] + op.u[2] * fu + op.v[2] * fv]);
      op.dA = A / 9;
    }
    this.ms = 0;
  }
  // can a ray from a get to b? (walks the voxels in 6 cm steps; stops `stopShort` before b)
  clear(ax, ay, az, bx, by, bz, stopShort = 0.15) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz), n = Math.floor((L - stopShort) / 0.06);
    if (n <= 0) return true;
    const sx = dx / L * 0.06, sy = dy / L * 0.06, sz = dz / L * 0.06;
    let x = ax, y = ay, z = az;
    for (let i = 0; i < n; i++) { x += sx; y += sy; z += sz; if (this.occ.filled(x, y, z)) return false; }
    return true;
  }
  at(px, py, pz, nx, ny, nz) {
    const occ = this.occ, near = occ.at(px, py, pz, nx, ny, nz), ox = px + nx * 0.07, oy = py + ny * 0.07, oz = pz + nz * 0.07;
    const ins = this.inside(px + nx * 0.05, py + ny * 0.05, pz + nz * 0.05);
    let fA = 0, fB = 0;
    if (ins) for (const op of this.openings) {
      let f = 0;
      for (const q of op.pts) {
        const dx = q[0] - ox, dy = q[1] - oy, dz = q[2] - oz, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
        const cp = (dx * nx + dy * ny + dz * nz) / d, co = (dx * op.n[0] + dy * op.n[1] + dz * op.n[2]) / d;
        if (cp <= 0 || co <= 0) continue;
        if (!this.clear(ox, oy, oz, q[0], q[1], q[2], 0.12)) continue;
        f += op.dA * cp * co / (Math.PI * d2 + op.dA);
      }
      if (op.front) fA += f; else fB += f;
    }
    // the lanterns: how much they light it (for the bounce), and how much of that gets here past the walls (the shader
    // works out each lantern's light per pixel and multiplies it by this: round pools on the floor, shadows behind walls)
    let lamp = 0, seen = 0;
    for (const L of this.lamps) {
      const dx = L.p[0] - px, dy = L.p[1] - py, dz = L.p[2] - pz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > L.reach * L.reach) continue;
      const d = Math.sqrt(d2), ndl = (dx * nx + dy * ny + dz * nz) / d;
      if (ndl < -0.1) continue;
      const fall = L.strength * lampFall(d2) * Math.max(0.02, (ndl + 0.1) / 1.1) * spotOf(L, -dx / d, -dy / d, -dz / d);
      const vis = this.clear(ox, oy, oz, L.p[0], L.p[1], L.p[2], 0.22) ? 1 : 0.1;
      lamp += fall * vis; seen += fall;
    }
    // (a surface facing down indoors sees the floor: some of the light that comes in bounces up to it)
    if (ins && ny < 0) fB += this.floor * -ny * (fA + fB + 0.02) * 4 + 0.13 * -ny;
    return [near, ins ? 1 : 0, fA, fB, Math.min(4, lamp), occ.rain(px, py, pz, nx, ny, nz), seen > 1e-4 ? lamp / seen : 1, this.fill ? this.fill(px, py, pz, nx, ny, nz) : 0];
  }
  // bake one geometry (m: its corners to the building's frame, for a door leaf; key: a name to keep that bake under)
  bake(geo, m = null, key = 'main') {
    const t0 = performance.now();
    const P = geo.attributes.position, N = geo.attributes.normal, n = P.count, v = new THREE.Vector3(), w = new THREE.Vector3(), nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    const B = { near: new Float32Array(n), ins: new Uint8Array(n), fA: new Float32Array(n), fB: new Float32Array(n), lamp: new Float32Array(n), rain: new Float32Array(n), vis: new Float32Array(n), fill: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i); w.fromBufferAttribute(N, i);
      if (m) { v.applyMatrix4(m); w.applyMatrix3(nm).normalize(); }
      const r = this.at(v.x, v.y, v.z, w.x, w.y, w.z);
      B.near[i] = r[0]; B.ins[i] = r[1]; B.fA[i] = r[2]; B.fB[i] = r[3]; B.lamp[i] = r[4]; B.rain[i] = r[5]; B.vis[i] = r[6]; B.fill[i] = r[7];
    }
    if (!geo.attributes.aAO) geo.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    if (!geo.attributes.aLamp) geo.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    // (a stone wall comes with its own shading in aAO, joints and all: that is kept, and this goes on top)
    if (geo.userData.ownAO && !geo.userData.ao0) geo.userData.ao0 = geo.attributes.aAO.array.slice();
    (geo.userData.bakes || (geo.userData.bakes = {}))[key] = B;
    this.ms += performance.now() - t0;
    return B;
  }
  apply(geo, open, key = 'main') {
    const B = geo.userData.bakes[key], A = geo.attributes.aAO.array, Lm = geo.attributes.aLamp.array, H = geo.attributes.aHalf, a0 = geo.userData.ao0;
    for (let i = 0; i < A.length; i++) {
      let ao;
      // (indoors the dark comes mostly from how little of the outside a corner sees; the close-in shading only deepens it
      // by half: at full strength the roof boards between the rafters went black, and the rafters read as slivers of light)
      if (B.ins[i]) ao = (0.5 + 0.5 * B.near[i]) * (this.base + (1 - this.base) * Math.min(1, this.gain * (B.fB[i] + (open ? B.fA[i] : 0)) + this.bounce * Math.min(1, B.lamp[i])));
      else ao = this.out[0] + this.out[1] * B.near[i];
      A[i] = a0 ? a0[i] * ao : ao;
      Lm[i * 2] = B.vis[i]; Lm[i * 2 + 1] = B.fill[i];
      if (H) H.array[i * 4 + 3] = B.rain[i];
    }
    geo.attributes.aAO.needsUpdate = true; geo.attributes.aLamp.needsUpdate = true; if (H) H.needsUpdate = true;
  }
}

// ── shader patches ───────────────────────────────────────────────────────────────────────────────────────────────────
// a lantern's light falling off with the distance (squared, softened close in, gone by 6.5 m): the same in the bake and
// in the shaders, so the bake's "how much gets past the walls" matches what the shader draws
export const LAMP_MAX = 12, LAMP_REACH = 6.5;
export const lampFall = (d2) => Math.max(0, 1 - d2 / (LAMP_REACH * LAMP_REACH)) ** 2 / (1 + d2 * 1.1);
// a lamp with a shade (L.dir: the way it points) lights only a cone under it: full within cosI of its axis, none past
// cosO (so a gooseneck lights the sign below it, not the wall above); (dx, dy, dz): the way from the lamp to the point
const SPOT = { cosI: 0.75, cosO: 0.5 };
export function spotOf(L, dx, dy, dz) {
  if (!L.dir) return 1;
  const c = dx * L.dir[0] + dy * L.dir[1] + dz * L.dir[2], t = Math.min(1, Math.max(0, (c - SPOT.cosO) / (SPOT.cosI - SPOT.cosO)));
  return t * t * (3 - 2 * t);
}
const LAMP_GLSL = `
uniform vec3 uLampP[${LAMP_MAX}]; uniform float uLampS[${LAMP_MAX}]; uniform vec4 uLampD[${LAMP_MAX}]; uniform float uLamp, uLampGain; uniform vec3 uLampCol;
vec3 lampLight(vec3 p, vec3 n) {
  float sum = 0.0;
  for (int i = 0; i < ${LAMP_MAX}; i++) {
    vec3 L = uLampP[i] - p; float d2 = dot(L, L), d = sqrt(d2) + 1e-4;
    float f = max(0.0, 1.0 - d2 / ${(LAMP_REACH * LAMP_REACH).toFixed(2)}); f *= f;
    float spot = mix(1.0, smoothstep(${SPOT.cosO.toFixed(3)}, ${SPOT.cosI.toFixed(3)}, dot(-L / d, uLampD[i].xyz)), uLampD[i].w);
    sum += uLampS[i] * f / (1.0 + d2 * 1.1) * max(0.02, (dot(n, L / d) + 0.1) / 1.1) * spot;
  }
  return uLampCol * (sum * uLamp * uLampGain);
}`;
// the uniforms they share (one object, so one switch turns every lantern on)
export const LU = {
  uLamp: { value: 1 },                                     // the lanterns: 0 out, 1 lit
  uLampCol: { value: new THREE.Color(1.0, 0.52, 0.2) },    // their light (linear)
  uLampGain: { value: 1.1 },
  uLampP: { value: Array.from({ length: LAMP_MAX }, () => new THREE.Vector3(0, -99, 0)) },   // where they are
  uLampS: { value: new Array(LAMP_MAX).fill(0) },          // how strong each is
  uLampD: { value: Array.from({ length: LAMP_MAX }, () => new THREE.Vector4(0, -1, 0, 0)) },   // a shaded lamp's way down (w 1)
  uNight: { value: 0 },                                    // 0 day .. 1 night (the window panes glow with the lamps inside)
  uPaintWear: { value: 0.5 },                              // how much of the paint has gone (0..1)
};
export function setLamps(lamps) {
  for (let i = 0; i < LAMP_MAX; i++) {
    const L = lamps[i]; LU.uLampP.value[i].set(...(L ? L.p : [0, -99, 0])); LU.uLampS.value[i] = L ? L.strength : 0;
    if (L && L.dir) LU.uLampD.value[i].set(...L.dir, 1); else LU.uLampD.value[i].set(0, -1, 0, 0);
  }
}
// chain a patch after whatever the material already has (the Material Lab's weathering, the Stone Lab's edges)
function chain(mat, key, fn) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r); Object.assign(sh.uniforms, LU); fn(sh); };
  mat.customProgramCacheKey = () => prevKey() + '+' + key;
  return mat;
}
const DIFFUSE = 'vec3 totalDiffuse = reflectedLight.directDiffuse';
// the lanterns' light, per pixel, times the bake's share that gets past the walls (aLamp); o.ao: also the baked sky
// shading (aAO), for a material that hasn't got it from the weathering; o.tint: each part's own tint (the kit's
// aTintPaint), likewise
export function lit(mat, o = {}) {
  return chain(mat, 'lit' + (o.ao ? 'ao' : '') + (o.tint ? 'tint' : ''), (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec2 aLamp; varying vec2 vLamp; varying vec3 vLW;${o.ao ? '\nattribute float aAO; varying float vAOb;' : ''}${o.tint ? '\nattribute vec4 aTintPaint; varying vec3 vTintB;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLamp = aLamp; vLW = (modelMatrix * vec4(position, 1.0)).xyz;${o.ao ? ' vAOb = aAO;' : ''}${o.tint ? ' vTintB = aTintPaint.rgb;' : ''}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
${LAMP_GLSL}
varying vec2 vLamp; varying vec3 vLW;${o.ao ? ' varying float vAOb;' : ''}${o.tint ? ' varying vec3 vTintB;' : ''}`)
      .replace('#include <map_fragment>', '#include <map_fragment>' + (o.tint ? '\ndiffuseColor.rgb *= vTintB;' : ''))
      .replace(DIFFUSE, `${o.ao ? 'reflectedLight.indirectDiffuse *= vAOb; reflectedLight.indirectSpecular *= vAOb;\n' : ''}reflectedLight.directDiffuse += diffuseColor.rgb * (lampLight(vLW, inverseTransformDirection(normal, viewMatrix)) * vLamp.x + uLampCol * (vLamp.y * uLamp * uLampGain));
${DIFFUSE}`);
  });
}
// THE BOARDS' FACES: paint worn off in patches (on top of the weathering's chips at the edges): in streaks down the
// boards (noise stretched tall), in big soft patches, more of it gone low down (splash, scuffs) and on the sunny side,
// less under the eaves, and more again where each board was given extra wear (aBoard.z: by the corners, the doors, the
// ground, and a little board by board); uPaintWear slides how much has gone. And NAILS: small dark heads where a board
// crosses a girt inside (the heights in NAIL_LINES), two across a board a quarter in from its edges, one in a batten's
// middle, each board's set a centimetre or two higher or lower (aBoard.y: the board's height, jittered)
export const NAIL_LINES = [0.6, 1.3, 2.35, 3.75, 5.0, 6.2, 7.2];
export function boardWear(mat) {
  return chain(mat, 'boardwear', (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aBoard; varying vec3 vBoard;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoard = aBoard;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uPaintWear; varying vec3 vBoard;')
      .replace('wPaintVis = wPainted * (1.0 - wChip);', `{
      float pAl = dot(wP.xz, vec2(-wN.z, wN.x));
      float pStreak = texture2D(uNoise, vec2(pAl * 2.3, wP.y * 0.09)).g * 0.7 + texture2D(uNoise, vec2(pAl * 6.0, wP.y * 0.3)).b * 0.3;
      float pSun = clamp(dot(wN, -uShadeDir) * 0.5 + 0.5, 0.0, 1.0);
      float pLow = 1.0 - smoothstep(0.4, 2.4, wP.y);
      float pEave = 1.0 - smoothstep(0.0, 0.9, wTop - wP.y);
      float pT = 0.6 * (pStreak - 0.5) + 0.45 * (wBig.r - 0.5) + 0.22 * pLow + 0.16 * pSun - 0.22 * pEave + 0.55 * vBoard.z - 0.08 + (uPaintWear - 0.5) * 0.9;
      float pOff = smoothstep(0.0, 0.08, pT + (wFine.b - 0.5) * 0.14);
      // (only the wall boards wear in patches, the ones with their own numbers: painted iron straps and leather don't)
      wPaintVis = wPainted * (1.0 - max(wChip, pOff * step(0.01, vBoard.x + vBoard.z)));
    }`)
      .replace('wBare = wWear * (1.0 - wPaintVis);', `#ifdef W_BOX
    if (vBoard.x > 0.25) {
      float nY = vLocalTop.y + vBoard.y, nL = 9.0;
      ${NAIL_LINES.map((y) => `nL = min(nL, abs(nY - ${y.toFixed(2)}));`).join(' ')}
      float nAx = abs(vLocalTop.x), nAc = vBoard.x > 0.75 ? abs(nAx - vHalf.x * 0.5) : nAx;
      float nD = length(vec2(nAc, nL));
      float nHead = 1.0 - smoothstep(0.0042, 0.0068, nD);
      diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.006, 0.018, nD)) * (1.0 - nHead);   // a faint rust stain round it
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.05, 0.045) * (1.0 + 1.5 * smoothstep(0.004, 0.0, length(vec2(nAc + 0.0015, nL - 0.0015)))), nHead);
    }
    #endif
    // (no paler rubbed edges on bare wood: they drew a bright line down every rafter and board; the paint still chips)
    wBare = 0.0;`);
  });
}
// the glow: lantern glass and flames, window panes. Unlit (they make their own light), brighter than white when lit
// (the tone mapping rolls it into a warm glow); dull glass when out
export function glowMaterial(o = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  if (o.panes) Object.assign(mat, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return chain(mat, 'glow' + (o.panes ? 'panes' : ''), (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aGlow, aGlowC; varying vec4 vGlow, vGlowC; varying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vGlowC = aGlowC; vGP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLamp, uNight; varying vec4 vGlow, vGlowC; varying vec3 vGP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float kWin = step(vGlow.a, 1.5);
        vec3 off = mix(vec3(0.16, 0.14, 0.11), vec3(0.035, 0.042, 0.05), kWin);
        float on = mix(uLamp, uLamp * uNight * 0.3, kWin);
        vec3 lit = vGlow.rgb;
        // (lantern glass: the flame's hot spot behind it, fading to a deep orange at its edges)
        if (vGlow.a > 1.5 && vGlow.a < 2.5) { float r = length(vGP - vGlowC.xyz) / vGlowC.w; lit *= mix(1.6, 0.18, smoothstep(0.05, 0.75, r)); off = vec3(0.04, 0.035, 0.03); }
        diffuseColor.rgb = mix(off, lit, on);
      }`);
  });
}
// a soft glow round each lantern: one sprite each (all of them one draw), added over what's behind, a warm haze that
// fades out from the flame
export function lanternGlow(lamps, o = {}) {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.18, 'rgba(255,170,80,0.55)'); gr.addColorStop(0.5, 'rgba(255,130,40,0.16)'); gr.addColorStop(1, 'rgba(255,110,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pos = new Float32Array(lamps.length * 3); lamps.forEach((L, i) => pos.set(L.glow || L.p, i * 3));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: tex, size: o.size ?? 0.9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff });
  const pts = new THREE.Points(geo, mat); pts.name = 'lantern glow'; pts.renderOrder = 2; pts.frustumCulled = false;
  return pts;
}
// lantern light on an animal (it has no baked numbers: it moves): the same per-pixel light as the building, and the
// sky light dimmed indoors (uShade, one number per animal, from the bake at the spot it stands)
export function animalLamps(mat, shade, fill = 0) {
  const own = { uShade: { value: shade }, uFill: { value: fill } };
  mat.userData.lampU = own;
  return chain(mat, 'animalLamps', (sh) => {
    Object.assign(sh.uniforms, own);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHW;').replace('#include <project_vertex>', '#include <project_vertex>\nvHW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
${LAMP_GLSL}
uniform float uShade, uFill; varying vec3 vHW;`)
      .replace(DIFFUSE, `reflectedLight.indirectDiffuse *= uShade; reflectedLight.indirectSpecular *= uShade;
reflectedLight.directDiffuse += diffuseColor.rgb * (lampLight(vHW, inverseTransformDirection(normal, viewMatrix)) * 0.85 + uLampCol * (uFill * uLamp * uLampGain));
${DIFFUSE}`);
  });
}
