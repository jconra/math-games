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
//   lit, paintWear, glowMaterial, animalLamps   the shader patches that read those numbers
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
        const tint = vary(k, bare ? o.tint.map((c) => c * 1.12) : o.tint, 0.86, 1.12), strip = Math.floor(k.R() * 10);
        k.board([bw + 0.002, h, bt], null, null, { m: wallM(w, ac, yc, -bt / 2), long: 1, tint, paint, strip, skip: '-z+x-x+y-y', cuts: cl, segFaces: '+z', slope: sl, outside: true });
        if (o.inTint) k.board([bw + 0.002, h, bt], null, null, { m: wallM(w, ac, yc, -bt / 2), long: 1, tint: vary(k, o.inTint, 0.85, 1.12), strip, skip: '+z+x-x+y-y', cuts: cl, segFaces: '-z', slope: sl, inside: true });
        if (o.solid !== false) k.solid([bw, h, 0.06], null, null, wallM(w, ac, yc, -bt / 2));
      } else {
        const paint = o.paint ? vary(k, o.paint, 0.92, 1.06) : null;
        k.board([bw, h - 0.01, 0.02], null, null, { m: wallM(w, ac, yc - 0.005, 0.01), long: 1, tint: vary(k, o.tint, 0.85, 1.05), paint, skip: '-z+y-y', cuts: cl, segFaces: '+z', slope: sl, outside: true });
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
  for (const [a, b] of [[x0 - 0.04, (x0 + x1) / 2 - 1.3], [(x0 + x1) / 2 - 1.3, (x0 + x1) / 2 + 1.1], [(x0 + x1) / 2 + 1.1, x1 + 0.04]]) wood([b - a, 0.06, 0.2], (a + b) / 2, 0.1, 0.03, null, { long: 0, tint: o.shakeT.map((c) => c * 0.62), strip: WOOD.shake, skip: '-z' });
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
        const m = frame(cx, s - dL + L / 2, th / 2 + 0.002 + (L / 2) * Math.sin(lift), extra);
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
  if (o.cap) for (const [a, b] of [[x0 - 0.05, (x0 + x1) / 2 - 0.9], [(x0 + x1) / 2 - 0.9, (x0 + x1) / 2 + 1.6], [(x0 + x1) / 2 + 1.6, x1 + 0.05]]) wood([b - a - 0.004, 0.028, 0.17], (a + b) / 2, len - 0.075, 0.068, null, { long: 0, tint: vary(k, o.shakeT, 0.7, 0.8), strip: 11, skip: '-y', roof: true });
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
      const ya = rails[r] + 0.075, yb = rails[r + 1] - 0.075, dx = iw - 0.16, dy = yb - ya, ang = Math.atan2(dy, dx), L = Math.hypot(dx, dy) - 0.06;
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
  const n = 12, rx = 0.2, ry = 0.29;
  for (let i = 0; i < n; i++) {
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
  k.box('iron', [0.014, 0.08, 0.014], [x, y + 0.18, z], null, { tint: iron });
  k.box('iron', [0.07, 0.012, 0.012], [x, y + 0.225, z], null, { tint: iron });
  k.parts.glow.push({ size: [0.11, 0.18, 0.11], m: T(x, y, z), kind: GLOW.glass, col: [1.0, 0.42, 0.1] });
  k.parts.glow.push({ size: [0.024, 0.055, 0.024], m: T(x, y - 0.03, z), kind: GLOW.flame, col: [7, 3.6, 1.1] });
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
export function glowGeometry(parts) {
  if (!parts.length) return null;
  const list = parts.map((P) => {
    const g = new THREE.BoxGeometry(...P.size); g.applyMatrix4(P.m); g.deleteAttribute('uv');
    const n = g.attributes.position.count, c = new Float32Array(n * 4), ctr = new Float32Array(n * 4), m = new THREE.Vector3().setFromMatrixPosition(P.m);
    for (let i = 0; i < n; i++) { c.set([...P.col, P.kind], i * 4); ctr.set([m.x, m.y - 0.03, m.z, Math.max(...P.size) / 2], i * 4); }
    g.setAttribute('aGlow', new THREE.BufferAttribute(c, 4)); g.setAttribute('aGlowC', new THREE.BufferAttribute(ctr, 4));
    return g;
  });
  return mergeGeometries(list);
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
// apply(geo, doorsOpen) turns them into aAO (sky light, darkened) and aLamp (the lanterns' warm light, added).
export class Light {
  // occ: an Occlusion (cabin.js) with the building's solids; o: inside(x, y, z) -> is this point indoors; openings
  // [{ c, u, v, n, front }] (middle, half-width and half-height vectors, the outward normal); lamps [{ p, reach, strength }]
  constructor(occ, o) {
    Object.assign(this, { occ, inside: o.inside, openings: o.openings || [], lamps: o.lamps || [], base: o.base ?? 0.1, gain: o.gain ?? 2.6, out: o.out ?? [0.35, 0.65], bounce: o.bounce ?? 0.15, floor: o.floor ?? 0.1 });
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
    let lamp = 0;
    for (const L of this.lamps) {
      const dx = L.p[0] - px, dy = L.p[1] - py, dz = L.p[2] - pz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > L.reach * L.reach) continue;
      const d = Math.sqrt(d2), ndl = (dx * nx + dy * ny + dz * nz) / d;
      if (ndl < -0.1) continue;
      const fall = (1 - d2 / (L.reach * L.reach)) ** 2 / (1 + d2 * 0.9);
      const vis = this.clear(ox, oy, oz, L.p[0], L.p[1], L.p[2], 0.22) ? 1 : 0.12;
      lamp += L.strength * fall * Math.max(0, (ndl + 0.1) / 1.1) * vis;
    }
    // (a surface facing down indoors sees the floor: some of the light that comes in bounces up to it)
    if (ins && ny < 0) fB += this.floor * -ny * (fA + fB + 0.02) * 4;
    return [near, ins ? 1 : 0, fA, fB, Math.min(4, lamp), occ.rain(px, py, pz, nx, ny, nz)];
  }
  // bake one geometry (m: its corners to the building's frame, for a door leaf; key: a name to keep that bake under)
  bake(geo, m = null, key = 'main') {
    const t0 = performance.now();
    const P = geo.attributes.position, N = geo.attributes.normal, n = P.count, v = new THREE.Vector3(), w = new THREE.Vector3(), nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    const B = { near: new Float32Array(n), ins: new Uint8Array(n), fA: new Float32Array(n), fB: new Float32Array(n), lamp: new Float32Array(n), rain: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i); w.fromBufferAttribute(N, i);
      if (m) { v.applyMatrix4(m); w.applyMatrix3(nm).normalize(); }
      const r = this.at(v.x, v.y, v.z, w.x, w.y, w.z);
      B.near[i] = r[0]; B.ins[i] = r[1]; B.fA[i] = r[2]; B.fB[i] = r[3]; B.lamp[i] = r[4]; B.rain[i] = r[5];
    }
    if (!geo.attributes.aAO) geo.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    if (!geo.attributes.aLamp) geo.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(n), 1));
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
      if (B.ins[i]) ao = B.near[i] * (this.base + (1 - this.base) * Math.min(1, this.gain * (B.fB[i] + (open ? B.fA[i] : 0)) + this.bounce * Math.min(1, B.lamp[i])));
      else ao = this.out[0] + this.out[1] * B.near[i];
      A[i] = a0 ? a0[i] * ao : ao;
      Lm[i] = B.lamp[i];
      if (H) H.array[i * 4 + 3] = B.rain[i];
    }
    geo.attributes.aAO.needsUpdate = true; geo.attributes.aLamp.needsUpdate = true; if (H) H.needsUpdate = true;
  }
}

// ── shader patches ───────────────────────────────────────────────────────────────────────────────────────────────────
// the uniforms they share (one object, so one switch turns every lantern on)
export const LU = {
  uLamp: { value: 1 },                                     // the lanterns: 0 out, 1 lit
  uLampCol: { value: new THREE.Color(1.0, 0.5, 0.18) },    // their light (linear)
  uLampGain: { value: 1.1 },
  uNight: { value: 0 },                                    // 0 day .. 1 night (the window panes glow with the lamps inside)
  uPaintWear: { value: 0.5 },                              // how much of the paint has gone (0..1)
};
// chain a patch after whatever the material already has (the Material Lab's weathering, the Stone Lab's edges)
function chain(mat, key, fn) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r); Object.assign(sh.uniforms, LU); fn(sh); };
  mat.customProgramCacheKey = () => prevKey() + '+' + key;
  return mat;
}
const DIFFUSE = 'vec3 totalDiffuse = reflectedLight.directDiffuse';
// the lanterns' baked light (aLamp) added as warm light on the surface; o.ao: also the baked sky shading (aAO), for a
// material that hasn't got it from the weathering; o.tint: each part's own tint (the kit's aTintPaint), likewise
export function lit(mat, o = {}) {
  return chain(mat, 'lit' + (o.ao ? 'ao' : '') + (o.tint ? 'tint' : ''), (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aLamp; varying float vLamp;${o.ao ? '\nattribute float aAO; varying float vAOb;' : ''}${o.tint ? '\nattribute vec4 aTintPaint; varying vec3 vTintB;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLamp = aLamp;${o.ao ? ' vAOb = aAO;' : ''}${o.tint ? ' vTintB = aTintPaint.rgb;' : ''}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uLamp, uLampGain; uniform vec3 uLampCol; varying float vLamp;${o.ao ? ' varying float vAOb;' : ''}${o.tint ? ' varying vec3 vTintB;' : ''}`)
      .replace('#include <map_fragment>', '#include <map_fragment>' + (o.tint ? '\ndiffuseColor.rgb *= vTintB;' : ''))
      .replace(DIFFUSE, `${o.ao ? 'reflectedLight.indirectDiffuse *= vAOb; reflectedLight.indirectSpecular *= vAOb;\n' : ''}reflectedLight.directDiffuse += diffuseColor.rgb * uLampCol * (vLamp * uLamp * uLampGain);
${DIFFUSE}`);
  });
}
// PAINT WORN OFF IN PATCHES (on top of the weathering's chips at the edges): in streaks down the boards (noise stretched
// tall), in big soft patches, more of it gone low down (splash, scuffs) and on the sunny side, less under the eaves.
// uPaintWear slides how much has gone.
export function paintWear(mat) {
  return chain(mat, 'paintwear', (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uPaintWear;')
      .replace('wPaintVis = wPainted * (1.0 - wChip);', `{
      float pAl = dot(wP.xz, vec2(-wN.z, wN.x));
      float pStreak = texture2D(uNoise, vec2(pAl * 2.3, wP.y * 0.09)).g * 0.7 + texture2D(uNoise, vec2(pAl * 6.0, wP.y * 0.3)).b * 0.3;
      float pSun = clamp(dot(wN, -uShadeDir) * 0.5 + 0.5, 0.0, 1.0);
      float pLow = 1.0 - smoothstep(0.4, 2.4, wP.y);
      float pEave = 1.0 - smoothstep(0.0, 0.9, wTop - wP.y);
      float pT = 0.55 * (pStreak - 0.5) + 0.45 * (wBig.r - 0.5) + 0.3 * pLow + 0.16 * pSun - 0.22 * pEave + (uPaintWear - 0.5) * 0.9;
      float pOff = smoothstep(0.02, 0.1, pT + (wFine.b - 0.5) * 0.12);
      wPaintVis = wPainted * (1.0 - max(wChip, pOff));
    }`);
  });
}
// the glow: lantern glass and flames, window panes. Unlit (they make their own light), brighter than white when lit
// (the tone mapping rolls it into a warm glow); dull glass when out
export function glowMaterial() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  return chain(mat, 'glow', (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aGlow, aGlowC; varying vec4 vGlow, vGlowC; varying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vGlowC = aGlowC; vGP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLamp, uNight; varying vec4 vGlow, vGlowC; varying vec3 vGP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float kWin = step(vGlow.a, 1.5), kFlame = step(2.5, vGlow.a) * step(vGlow.a, 3.5);
        vec3 off = mix(vec3(0.16, 0.14, 0.11), vec3(0.03, 0.036, 0.042), kWin);
        float on = mix(uLamp, uLamp * uNight * 0.55, kWin);
        vec3 lit = vGlow.rgb;
        // (lantern glass: the flame's hot spot behind it, fading to a deep orange at its edges)
        if (vGlow.a > 1.5 && vGlow.a < 2.5) { float r = length(vGP - vGlowC.xyz) / vGlowC.w; lit *= mix(3.2, 0.45, smoothstep(0.1, 0.85, r)); }
        diffuseColor.rgb = mix(off, lit, on);
        // (a pane seen from indoors: the day outside, going with the evening)
        if (vGlow.a > 3.5) diffuseColor.rgb = mix(vec3(0.42, 0.5, 0.58), vec3(0.03, 0.04, 0.07), uNight);
      }`);
  });
}
// lantern light on an animal (it has no baked numbers: it moves): up to six lanterns as uniforms, each lighting what
// faces it, falling off with the distance squared; and the sky light dimmed indoors (uShade, one number per animal,
// from the bake at the spot it stands)
export const LAMP_MAX = 6;
export function animalLamps(mat, lamps, shade) {
  const P = [], S = [];
  for (let i = 0; i < LAMP_MAX; i++) { const L = lamps[i]; P.push(new THREE.Vector3(...(L ? L.p : [0, -99, 0]))); S.push(L ? L.strength : 0); }
  const own = { hLampP: { value: P }, hLampS: { value: S }, uShade: { value: shade } };
  mat.userData.lampU = own;
  return chain(mat, 'animalLamps', (sh) => {
    Object.assign(sh.uniforms, own);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHW;').replace('#include <project_vertex>', '#include <project_vertex>\nvHW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 hLampP[${LAMP_MAX}]; uniform float hLampS[${LAMP_MAX}]; uniform float uLamp, uLampGain, uShade; uniform vec3 uLampCol; varying vec3 vHW;`)
      .replace(DIFFUSE, `reflectedLight.indirectDiffuse *= uShade; reflectedLight.indirectSpecular *= uShade;
{
  vec3 hN = inverseTransformDirection(normal, viewMatrix);
  for (int i = 0; i < ${LAMP_MAX}; i++) {
    vec3 L = hLampP[i] - vHW; float d2 = dot(L, L), d = sqrt(d2);
    float fall = hLampS[i] * max(0.0, 1.0 - d2 / 42.0) / (1.0 + d2 * 0.9);
    reflectedLight.directDiffuse += diffuseColor.rgb * uLampCol * (0.7 * uLamp * uLampGain * fall * max(0.0, (dot(hN, L / d) + 0.2) / 1.2));
  }
}
${DIFFUSE}`);
  });
}
