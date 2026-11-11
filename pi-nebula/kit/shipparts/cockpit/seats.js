// COCKPIT SEATS, in the look of his pictures' cockpits (padded seats with side bolsters, dark armrests, a pedestal on
// rails). Each faces +z (the way its sitter faces), stands on the deck (y = 0) and is centred on x = 0; its base fits a
// 0.5 m cell, the seat itself is a little wider (0.62 m across the armrests).
//   flightSeat(p, o)   the pilot's and co-pilot's seat: headrest, armrests, a five-point harness, on a pedestal that
//                      slides along two rails. o: h (cushion top, 0.48), w (cushion width, 0.46), d (cushion depth, 0.47),
//                      back (backrest height, 0.6), recline (radians, 0.21), arm (armrest top above the cushion, 0.22),
//                      arms ('both' | 'none'), harness (true), headrest (true), slide (how far the seat sits forward on
//                      its rails, -0.1 to 0.15; 0), look ('tan' | 'grey' | 'station' | 'ship'), stick / throttle ('left' |
//                      'right' | null: a flight stick or a one-lever throttle on that armrest's end; the sitter's left,
//                      toward +x), badge ('pilot' | 'co-pilot' | 'engineer' | 'crew' | null: a stencilled role on the
//                      headrest's back), shape ('padded': the padded seat on its frame | 'bucket': one moulded shell, the
//                      pan, the back, deep side wings and the head box all one piece, padded inserts set into it, on the
//                      same base, armrests and harness; its sizes follow the seated person, so `back` only sets the
//                      harness's slots. The ships' flight seat is the bucket in the 'ship' look)
//   crewSeat(p, o)     the engineer's (or any crew) seat: a swivel seat on a round foot, a lower back, a stubby
//                      headrest, armrests, no harness. o: h (0.48), w (0.46), back (0.5), arms (true), look, badge
//   jumpSeat(p, o)     a fold-down seat on a wall: its back on the wall (z = 0), standing on the deck. o: w (0.44),
//                      h (0.46), open (true: the seat is down), harness (true), look
//   SEAT               the flight seat's defaults, and where a sitter's eye, shoulders and hands are (for a 1.75 m person,
//                      measured from the seat): the cockpit set and its checks read these
import * as THREE from 'three';
import { rrect, MeshData } from '../../geo.js';
import { fixFrames } from '../../wallkit.js';
import { part } from '../place.js';
import { SEAT_LOOK, LEAN, bar, mount } from './look.js';
import { flightStick, throttle } from './controls.js';

const PI = Math.PI, v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SOFT = { r: 0.026, seg: 1, cell: 9, loops: [] }, FIRM = { r: 0.012, seg: 1, cell: 9, loops: [] }, FLAT = { r: 0 };
// a seated 1.75 m person (from the cushion top and the backrest's line): eye 0.79 m up and 0.17 m out from the
// backrest, shoulder joints 0.58 m up, 0.1 m out and 0.19 m to each side, elbows 0.23 m up
export const SEAT = { h: 0.48, w: 0.46, d: 0.47, back: 0.6, recline: 0.21, arm: 0.22, eye: [0.79, 0.17], shoulder: [0.58, 0.1, 0.19], elbow: 0.23 };
// where things are on a flight seat built with options o: the backrest's line at a height above the cushion, the
// eye, the shoulders (the sitter's right one first, at -x), the armrest ends (where a stick or throttle stands). Left and
// right are the sitter's: facing +z, their left hand is toward +x
export function seatPoints(o = {}) {
  const S = { ...SEAT, slide: 0, ...o }, zb = S.slide - S.d / 2 + 0.02;   // (the backrest's foot, on the cushion's back edge)
  const backAt = (u) => zb - u * Math.tan(S.recline);
  const eye = [0, S.h + S.eye[0], backAt(S.eye[0]) + S.eye[1]];
  const shoulders = [-1, 1].map((s) => [s * S.shoulder[2], S.h + S.shoulder[0], backAt(S.shoulder[0]) + S.shoulder[1]]);
  const xa = S.w / 2 + 0.045, armTop = S.h + S.arm, armEnd = S.slide + S.d / 2 - 0.08;
  return { eye, shoulders, arm: { left: [xa, armTop, armEnd], right: [-xa, armTop, armEnd] }, backAt, h: S.h, slide: S.slide, recline: S.recline };
}

// a flat strap swept along points (a harness belt): width w, its face toward `face`
function strap(p, surf, pts, face, w = 0.045) {
  const path = fixFrames(pts.map((q) => ({ p: v3(...q), x: v3(1, 0, 0), y: face.clone() })));
  p.sweep(surf, rrect(w, 0.007, 0.0025, 1), path);
}

// a closed surface lofted through rings, each a closed loop of the same number of points { p: [x, y, z], n: its outward
// normal }; uv in metres (x across, and the distance along the rings). The first and last `ends` rings take their
// normals from the surface itself (a rounded end closes too fast for a profile's normals), turned to agree with theirs.
function loft(p, surf, rings, ends = 0) {
  const m = new MeshData(), np = rings[0].length, nr = rings.length;
  if (ends) {
    const acc = rings.map((r) => r.map(() => [0, 0, 0])), at = (i, j) => rings[i][(j + np) % np].p;
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < np; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j), e = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], f = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
      const n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];   // (the quad's diagonals: its normal, by its area)
      for (const [ii, jj] of [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]]) { const s = acc[ii][jj % np]; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; }
    }
    for (let i = 0; i < nr; i++) if (i < ends || i >= nr - ends) rings[i].forEach((v, j) => {
      const s = acc[i][j], l = Math.hypot(...s); if (l < 1e-12) return;
      const k = (s[0] * v.n[0] + s[1] * v.n[1] + s[2] * v.n[2] < 0 ? -1 : 1) / l; v.n = [s[0] * k, s[1] * k, s[2] * k];
    });
  }
  let along = 0;
  rings.forEach((r, i) => {
    if (i) along += Math.hypot(r[0].p[0] - rings[i - 1][0].p[0], r[0].p[1] - rings[i - 1][0].p[1], r[0].p[2] - rings[i - 1][0].p[2]);
    for (const q of r) m.v(q.p[0], q.p[1], q.p[2], q.n[0], q.n[1], q.n[2], q.p[0], along);
  });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < np; j++) { const a = i * np + j, b = i * np + (j + 1) % np; m.quad(a, b, b + np, a + np); }
  return p.add('solid', m.geometry(), surf);
}

// THE BUCKET (flightSeat's shape 'bucket'): one moulded shell, the pan, the back, the side wings and the head box all one
// closed surface, with padded inserts set into it. The shell is lofted through stations along its floor (in side view:
// the pan, the crease, up the back to the head), each station a U across the seat: the outside of the shell, a rounded
// outer corner, the wall's outer face, a rounded lip, the wall's inner face, the floor. A second line, the lip's, sets
// how deep each wing is: deep along the thighs and round the hips (up to just under the elbows), low where the upper arms
// hang beside the torso (so they swing clear), deep again over the shoulders, and round the head. Its sizes follow the
// seated person (SEAT.eye and SEAT.shoulder), so the armrests, the harness and seatPoints are the same as the padded seat's.
// The inserts the sitter sinks into are noted in p.rests (part indices), so the checks can test the pose against the rest
// of the seat (the shell's wings, the armrests).
function bucketBody(p, S, { h, w, d, recline, headrest, badge, arms, z0 }, B, bslab) {
  const c = Math.cos(recline), s = Math.sin(recline), zc0 = z0 - d / 2, zc1 = z0 + d / 2, q = Math.SQRT1_2;
  // (side view, [y, z]: the backrest's frame is flightSeat's, u up it from its foot, n out of its face)
  const foot = [h - 0.04, zc0 + 0.02], UP = [c, -s], FW = [s, c];
  const bk = (u, n) => [foot[0] + u * c + n * s, foot[1] - u * s + n * c];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = (a) => Math.hypot(a[0], a[1]), unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const bez = (a, k, b, f) => [0, 1].map((i) => (1 - f) ** 2 * a[i] + 2 * f * (1 - f) * k[i] + f * f * b[i]);
  const bezN = (a, k, b, f) => { const t = unit([0, 1].map((i) => (1 - f) * (k[i] - a[i]) + f * (b[i] - k[i]))); return [-t[1], t[0]]; };   // (the floor's normal, into the seat)
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, mix = (a, b, t) => a + (b - a) * t;
  // the floor (the shell's inside, under the cushion and behind the back's pad) and its thickness
  const yF = h - 0.08, nF = -0.05, t = 0.028;
  // the lip: the thigh bolsters' height over the floor (lower at the front), and how far each wing stands out of the back
  const Hth = 0.17, Ht = (z) => Hth - 0.05 * sm(zc1 - 0.16, zc1, z);
  const nL = (u) => (u < 0.3 ? 0.15 : u < 0.62 ? mix(0.15, 0.035, sm(0.3, 0.4, u)) : u < 0.77 ? mix(0.035, 0.14, sm(0.62, 0.655, u)) : mix(0.14, 0.18, sm(0.77, 0.81, u)));
  // the walls' inner and outer faces, across the seat: the pan's (the thigh bolsters flaring out to the front edge), the
  // back's (a little wider, for the chest), narrowing over the shoulders, then the head box's
  const Wi0 = w / 2 - 0.045, W0 = w / 2 + 0.008, WiB = Wi0 + 0.02, flare = (z) => sm(zc1 - 0.22, zc1, z);
  const Wi = (u) => mix(mix(WiB, 0.155, sm(0.62, 0.655, u)), 0.1, sm(0.76, 0.81, u)), Wo = (u) => mix(mix(W0, W0 + 0.016, sm(0.35, 0.6, u)), 0.17, sm(0.76, 0.81, u));   // (broader over the shoulders, above the armrests)
  // the corners where the pan turns up into the back: the floor's, and the lip's (where a thigh bolster meets its hip wing)
  const uF = (yF - foot[0] - nF * s) / c, KF = bk(uF, nF), tF = 0.05, F1 = [yF, KF[1] + tF], F2 = add(KF, UP, tF);
  const nHip = nL(0), uK = (yF + Hth - foot[0] - nHip * s) / c, KL = bk(uK, nHip), tL = 0.06, L1 = [yF + Hth, KL[1] + tL], L2 = add(KL, UP, tL);
  const st = [];
  for (const f of [0, 0.2, 0.45, 0.72, 1]) { const zF = mix(zc1, F1[1], f), zL = mix(zc1, L1[1], f); st.push({ F: [yF, zF], N: [1, 0], L: [yF + Ht(zL), zL], Wi: Wi0 + 0.025 * flare(zF), W: W0 + 0.02 * flare(zF) }); }
  for (const f of [0.5, 1]) st.push({ F: bez(F1, KF, F2, f), N: bezN(F1, KF, F2, f), L: bez(L1, KL, L2, f), Wi: mix(Wi0, WiB, f), W: W0 });
  // (up the back the outside bows out a little across the seat, as a moulded back does; the head box's back stays flat)
  const bow = (u) => 0.025 * sm(0.02, 0.15, u) * (1 - sm(0.7, 0.77, u));
  for (const f of [0.33, 0.67, 1]) { const uf = mix(uF + tF, 0.3, f), ul = mix(uK + tL, 0.3, f); st.push({ F: bk(uf, nF), N: FW, L: bk(ul, nL(ul)), Wi: Wi(uf), W: Wo(uf), b: bow(uf) }); }
  const uTop = headrest ? 0.94 : 0.74;
  for (const u of [0.36, 0.4, 0.6, 0.625, 0.655, 0.7, 0.76, 0.81, uTop]) if (u <= uTop) st.push({ F: bk(u, nF), N: FW, L: bk(u, nL(u)), Wi: Wi(u), W: Wo(u), b: bow(u) });
  // each station's U, the right half (from the middle of the outside, round the wall, back to the middle of the floor),
  // then the left half mirrored; each point with its normal (x, and its side-view part)
  const ro = 0.03;
  const ring = ({ F, N, L, Wi: wi, W, b = 0 }) => {
    const O = add(F, N, -t), G = unit(sub(L, F)), rl = (W - wi) / 2, wm = (W + wi) / 2, Lc = add(L, G, -rl), Go = unit(sub(Lc, O));
    const tb = 2 * Math.atan2(b, W - ro), cb = Math.cos(tb), sb = Math.sin(tb);   // (the bow: the outside's slope where it meets the corner)
    const ri = Math.max(0.004, Math.min(0.02, len(sub(L, F)) - rl - 0.004));
    const P = (x, yz, nx, n2) => ({ p: [x, yz[0], yz[1]], n: [nx, n2[0], n2[1]] });
    const half = [
      P(0, add(O, N, -b), 0, [-N[0], -N[1]]), P(W - ro, O, sb, [-N[0] * cb, -N[1] * cb]), P(W - ro * (1 - q), add(O, Go, ro * (1 - q)), q, [-N[0] * q, -N[1] * q]),   // (the outside, its corner)
      P(W, add(O, Go, ro), 1, [0, 0]), P(W, Lc, 1, [0, 0]),   // (the wall's outer face)
      P(wm + rl * q, add(Lc, G, rl * q), q, [G[0] * q, G[1] * q]), P(wm, add(Lc, G, rl), 0, G), P(wm - rl * q, add(Lc, G, rl * q), -q, [G[0] * q, G[1] * q]),   // (the lip)
      P(wi, Lc, -1, [0, 0]), P(wi, add(F, G, ri), -1, [0, 0]),   // (the wall's inner face)
      P(wi - ri * (1 - q), add(F, G, ri * (1 - q)), -q, [N[0] * q, N[1] * q]), P(wi - ri, F, 0, N), P(0, F, 0, N),   // (into the floor)
    ];
    return [...half, ...half.slice(1, -1).reverse().map((v) => ({ p: [-v.p[0], v.p[1], v.p[2]], n: [-v.n[0], v.n[1], v.n[2]] }))];
  };
  const rings = st.map(ring), n = rings.length, np = rings[0].length;
  // (the normals: square to the run of the rings as well)
  const tang = rings.map((r, i) => r.map((v, j) => { const a = rings[Math.max(0, i - 1)][j].p, b = rings[Math.min(n - 1, i + 1)][j].p; return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; }));
  rings.forEach((r, i) => r.forEach((v, j) => {
    const T = tang[i][j], l = Math.hypot(...T); if (l < 1e-9) return;
    const k = (v.n[0] * T[0] + v.n[1] * T[1] + v.n[2] * T[2]) / (l * l), m = [v.n[0] - k * T[0], v.n[1] - k * T[1], v.n[2] - k * T[2]], ml = Math.hypot(...m);
    v.n = m.map((x) => x / ml);
  }));
  // the two ends closed by rounding them over onto the shell's middle: the pan's front edge, and the top
  const cap = (r, F, N, E, e) => [0.7, 1.25, Math.PI / 2].map((a) => r.map((v) => {
    const M = add(F, N, -t / 2), ca = Math.cos(a), sa = Math.sin(a), b = [v.p[1], v.p[2]], at = add(add(M, sub(b, M), ca), E, e * sa);
    const nn = [v.n[0] * ca, v.n[1] * ca + E[0] * sa, v.n[2] * ca + E[1] * sa], nl = Math.hypot(...nn);
    return { p: [v.p[0], at[0], at[1]], n: nn.map((x) => x / nl) };
  }));
  const front = cap(rings[0], st[0].F, st[0].N, [0, 1], 0.028).reverse(), top = cap(rings[n - 1], st[n - 1].F, st[n - 1].N, UP, 0.03);
  loft(p, S.shell, [...front, ...rings, ...top], front.length);
  // under it: a mounting plate on the pedestal; on each side, a dark plate the armrest's bracket and strut bolt to
  p.slab(S.frame, -0.15, 0.15, h - 0.114, h - 0.1, z0 - 0.17, z0 + 0.1, FLAT);
  const xa = w / 2 + 0.045;
  if (arms !== 'none') for (const sd of [-1, 1]) p.slab(S.frame, sd > 0 ? W0 - 0.004 : -xa + 0.018, sd > 0 ? xa - 0.018 : -W0 + 0.004, h - 0.1, h + 0.05, zc0 + 0.035, zc0 + 0.25, FLAT);
  // the inserts: the cushion (two stitched channels), the back's pad (channels, a lumbar seam), the head's pad
  const rest = () => (p.rests ||= []).push(p.parts.length - 1);
  p.slab(S.pad, -Wi0 - 0.016, Wi0 + 0.016, yF - 0.004, h, zc0 + 0.05, zc1 + 0.004, SOFT); rest();   // (its sides run into the walls, out to the bolsters' flare)
  for (const x of [-0.055, 0.055]) { p.slab(S.seam, x - 0.006, x + 0.006, h - 0.006, h + 0.003, zc0 + 0.09, zc1 - 0.04, { r: 0 }); rest(); }
  bslab(S.pad, -WiB + 0.004, WiB - 0.004, 0.02, 0.625, nF - 0.004, 0.045, SOFT); rest();
  for (const x of [-0.055, 0.055]) { bslab(S.seam, x - 0.006, x + 0.006, 0.05, 0.6, 0.04, 0.049, { r: 0 }); rest(); }
  bslab(S.seam, -WiB + 0.03, WiB - 0.03, 0.25, 0.262, 0.04, 0.049, { r: 0 }); rest();
  if (headrest) {
    bslab(S.pad, -0.096, 0.096, 0.775, 0.925, nF - 0.004, 0.04, SOFT); rest();
    // (a dark name plate on the head box's back, its role stencilled on it)
    const nb = nF - t;
    if (badge) { bslab(S.frame, -0.11, 0.11, 0.835, 0.895, nb - 0.006, nb + 0.002, FLAT); p.decal('cp:badge:' + badge, 0.2, 0.05, B(0, 0.865, nb - 0.0075), [-recline, PI, 0], '#e8e4da'); }
  }
}

export function flightSeat(p, o = {}) {
  const { h = SEAT.h, w = SEAT.w, d = SEAT.d, back = SEAT.back, recline = SEAT.recline, arm = SEAT.arm, arms = 'both', harness = true, headrest = true, slide = 0, look = 'tan', stick = null, throttle: thr = null, badge = null, shape = 'padded' } = o;
  const S = SEAT_LOOK[look] || SEAT_LOOK.tan, z0 = slide, zc0 = z0 - d / 2, zc1 = z0 + d / 2, bucket = shape === 'bucket';
  // the base: a plate bolted to the deck, two rails the seat slides on, end stops
  p.slab('black', -0.2, 0.2, 0, 0.022, -0.24, 0.24, FLAT);
  for (const x of [-0.13, 0.13]) { p.slab('rail', x - 0.016, x + 0.016, 0.022, 0.046, -0.235, 0.235, FLAT); for (const z of [-0.225, 0.225]) p.slab('black', x - 0.022, x + 0.022, 0.022, 0.06, z - 0.012, z + 0.012, { r: 0 }); }
  // the carriage on the rails, a boot and the pedestal up to the pan, the slide lever under the front edge
  p.slab(S.frame, -0.165, 0.165, 0.046, 0.08, z0 - 0.16, z0 + 0.16, FLAT);
  p.slab('rubber', -0.1, 0.1, 0.08, 0.17, z0 - 0.12, z0 + 0.08, LEAN);
  p.slab(S.frame, -0.075, 0.075, 0.17, h - 0.1, z0 - 0.1, z0 + 0.05, FLAT);
  p.box('yellow', [0.12, 0.016, 0.016], [0.06, h - 0.13, zc1 - 0.04], null, { r: 0 });
  p.box('black', [0.016, 0.016, 0.07], [0.006, h - 0.13, zc1 - 0.07], null, { r: 0 });
  if (!bucket) {
    // the pan, the cushion between two raised side bolsters, a rolled front edge
    p.slab(S.frame, -w / 2 - 0.015, w / 2 + 0.015, h - 0.11, h - 0.065, zc0, zc1 - 0.01, FLAT);
    p.slab(S.pad, -w / 2 + 0.07, w / 2 - 0.07, h - 0.075, h, zc0 + 0.03, zc1 - 0.03, SOFT);
    for (const s of [-1, 1]) p.slab(S.seam, s < 0 ? -w / 2 : w / 2 - 0.072, s < 0 ? -w / 2 + 0.072 : w / 2, h - 0.075, h + 0.045, zc0 + 0.03, zc1, SOFT);
    p.slab(S.seam, -w / 2 + 0.07, w / 2 - 0.07, h - 0.08, h - 0.005, zc1 - 0.06, zc1, SOFT);
  }
  // the backrest: built in its own frame (u along it, n out of its face), leaning back by `recline` from its foot
  const up = v3(0, Math.cos(recline), -Math.sin(recline)), fwd = v3(0, Math.sin(recline), Math.cos(recline)), foot = v3(0, h - 0.04, zc0 + 0.02);
  const B = (x, u, n) => foot.clone().addScaledVector(up, u).addScaledVector(fwd, n).setX(x).toArray();
  const bslab = (surf, x0, x1, u0, u1, n0, n1, opts) => p.box(surf, [x1 - x0, u1 - u0, n1 - n0], B((x0 + x1) / 2, (u0 + u1) / 2, (n0 + n1) / 2), [-recline, 0, 0], opts);
  if (bucket) bucketBody(p, S, { h, w, d, recline, headrest, badge, arms, z0 }, B, bslab);
  else {
    // (a shell behind, a thick pad, deep side bolsters that wrap the shoulders, a stitched seam across)
    bslab(S.shell, -w / 2 - 0.025, w / 2 + 0.025, 0, back + 0.01, -0.1, -0.04, { ...FIRM, r: 0.022 });
    bslab(S.pad, -w / 2 + 0.08, w / 2 - 0.08, 0.03, back - 0.02, -0.05, 0.045, SOFT);
    for (const s of [-1, 1]) bslab(S.seam, s < 0 ? -w / 2 - 0.02 : w / 2 - 0.095, s < 0 ? -w / 2 + 0.095 : w / 2 + 0.02, 0.04, back * 0.97, -0.05, 0.12, SOFT);
    bslab(S.seam, -w / 2 + 0.08, w / 2 - 0.08, back * 0.42, back * 0.47, -0.045, 0.049, { r: 0 });
    for (const x of [-0.05, 0.05]) bslab(S.seam, x - 0.006, x + 0.006, 0.06, back - 0.04, -0.045, 0.049, { r: 0 });   // (stitched channels down it)
    for (const s of [-1, 1]) bslab(S.frame, s * (w / 2 + 0.025) - 0.008, s * (w / 2 + 0.025) + 0.008, 0.02, back - 0.01, -0.1, -0.035, { r: 0 });   // (dark sides on the shell)
    for (const u of [back * 0.3, back * 0.62]) bslab(S.seam, -w / 2 - 0.018, w / 2 + 0.018, u, u + 0.012, -0.104, -0.096, { r: 0 });   // (seams across its back)
    if (headrest) {
      // (a dark neck, then the headrest: its own shell behind it, a role badge on its back)
      bslab(S.frame, -0.1, 0.1, back - 0.01, back + 0.04, -0.09, 0.02, { r: 0 });
      bslab(S.shell, -0.2, 0.2, back + 0.03, back + 0.34, -0.1, -0.04, { ...FIRM, r: 0.022 });
      bslab(S.pad, -0.19, 0.19, back + 0.035, back + 0.33, -0.06, 0.06, SOFT);
      for (const s of [-1, 1]) bslab(S.seam, s < 0 ? -0.2 : 0.13, s < 0 ? -0.13 : 0.2, back + 0.04, back + 0.32, -0.06, 0.09, SOFT);   // (its wings)
      bslab(S.seam, -0.13, 0.13, back + 0.035, back + 0.065, -0.062, 0.062, FLAT);
      bslab(S.seam, -0.2, 0.2, back + 0.27, back + 0.285, -0.104, -0.096, { r: 0 });   // (a seam across its back)
      if (badge) p.decal('cp:badge:' + badge, 0.2, 0.05, B(0, back + 0.2, -0.1015), [-recline, PI, 0], '#e8e4da');
    }
  }
  if (harness) {
    for (const s of [-1, 1]) bslab('black', s * 0.085 - 0.03, s * 0.085 + 0.03, back - 0.06, back - 0.045, -0.04, 0.048, { r: 0 });   // the strap slots
    const buckle = [0, h + 0.05, zc0 + 0.24], face = fwd.clone();
    for (const s of [-1, 1]) {
      strap(p, S.strap, [B(s * 0.085, back - 0.05, 0.051), B(s * 0.08, back * 0.6, 0.055), B(s * 0.065, 0.16, 0.06), [s * 0.04, h + 0.055, zc0 + 0.2]], face);
      strap(p, S.strap, [[s * (w / 2 - 0.08), h + 0.035, zc0 + 0.07], [s * 0.12, h + 0.05, zc0 + 0.17], [s * 0.035, h + 0.052, buckle[2]]], v3(0, 1, 0), 0.04);
    }
    strap(p, S.strap, [[0, h - 0.004, zc1 - 0.07], [0, h + 0.02, zc1 - 0.14], [0, h + 0.048, buckle[2] + 0.03]], v3(0, 1, 0), 0.04);
    p.cyl('chrome', 0.032, 0.014, buckle, [PI / 2 - 0.15, 0, 0], 10);
    p.cyl('dark', 0.02, 0.016, [0, buckle[1] + 0.002, buckle[2] + 0.002], [PI / 2 - 0.15, 0, 0], 8);
  }
  // armrests: a bracket from the pan up at the back, a padded rest, a plate at its end for a stick or a throttle
  if (arms !== 'none') {
    const xa = w / 2 + 0.045, top = h + arm, z1 = zc1 - 0.03;   // (the armrests stop short of the cushion's front)
    for (const s of [-1, 1]) {
      const x = s * xa;
      p.slab(S.frame, x - 0.02, x + 0.02, h - 0.1, top - 0.03, zc0 + 0.04, zc0 + 0.12, FLAT);
      bar(p, S.frame, [x, h - 0.08, zc0 + 0.22], [x, top - 0.04, zc0 + 0.36], 0.024);
      p.slab(S.frame, x - 0.032, x + 0.032, top - 0.045, top - 0.02, zc0 + 0.04, z1, FLAT);
      p.slab(S.arm, x - 0.035, x + 0.035, top - 0.028, top, zc0 + 0.03, z1 - 0.07, { ...SOFT, r: 0.012 });
      p.slab('black', x - 0.035, x + 0.035, top - 0.028, top - 0.002, z1 - 0.07, z1, LEAN);
    }
    const P = seatPoints({ h, w, d, recline, arm, slide });
    if (stick) mount(p, part(flightStick, { mount: 'arm', hand: stick }), { at: P.arm[stick] }, 'stick', 'y');
    if (thr) mount(p, part(throttle, { mount: 'arm' }), { at: P.arm[thr], scale: thr === 'left' ? [-1, 1, 1] : 1 }, 'throttle', 'y');
  }
}

export function crewSeat(p, o = {}) {
  const { h = SEAT.h, w = SEAT.w, back = 0.5, arms = true, look = 'tan', badge = null } = o;
  const S = SEAT_LOOK[look] || SEAT_LOOK.tan, d = 0.44, rec = 0.16;
  // a round foot bolted to the deck, a column, a swivel under the pan
  p.lathe('black', [[0.001, 0], [0.2, 0], [0.205, 0.012], [0.19, 0.03], [0.06, 0.045], [0.001, 0.045]], 14);
  p.cyl('gun', 0.05, h - 0.17, [0, 0.045 + (h - 0.17) / 2, 0], null, 12);
  p.lathe('rubber', [[0.001, 0.045], [0.08, 0.045], [0.07, 0.08], [0.055, 0.12], [0.001, 0.12]], 12);   // (a boot over its foot)
  p.cyl(S.frame, 0.045, 0.1, [0, 0.1, 0], null, 10);
  p.cyl(S.frame, 0.07, 0.03, [0, h - 0.11, 0], null, 12);
  p.slab(S.frame, -w / 2 - 0.01, w / 2 + 0.01, h - 0.1, h - 0.065, -d / 2, d / 2 - 0.01, FLAT);
  p.slab(S.pad, -w / 2 + 0.02, w / 2 - 0.02, h - 0.075, h, -d / 2 + 0.02, d / 2, SOFT);
  p.slab(S.seam, -w / 2 + 0.02, w / 2 - 0.02, h - 0.08, h - 0.006, d / 2 - 0.05, d / 2, SOFT);
  // the back on a spine from behind the pan
  const up = v3(0, Math.cos(rec), -Math.sin(rec)), fwd = v3(0, Math.sin(rec), Math.cos(rec)), foot = v3(0, h + 0.02, -d / 2 + 0.01);
  const B = (x, u, n) => foot.clone().addScaledVector(up, u).addScaledVector(fwd, n).setX(x).toArray();
  p.box(S.frame, [0.06, 0.26, 0.03], [0, h - 0.04, -d / 2 - 0.03], [-0.25, 0, 0], FLAT);
  p.box(S.shell, [w + 0.02, back, 0.05], B(0, back / 2, -0.06), [-rec, 0, 0], { ...FIRM, r: 0.018 });
  p.box(S.pad, [w - 0.02, back - 0.06, 0.07], B(0, back / 2 + 0.01, -0.01), [-rec, 0, 0], SOFT);
  p.box(S.seam, [w - 0.04, 0.03, 0.074], B(0, back * 0.45, -0.01), [-rec, 0, 0], { r: 0 });
  // side bolsters and a stubby headrest, as on the flight seats
  for (const s of [-1, 1]) p.box(S.seam, [0.07, back - 0.08, 0.1], B(s * (w / 2 - 0.035), back / 2 + 0.01, 0.0), [-rec, 0, 0], SOFT);
  p.box(S.shell, [0.3, 0.2, 0.05], B(0, back + 0.08, -0.06), [-rec, 0, 0], { ...FIRM, r: 0.018 });
  p.box(S.pad, [0.28, 0.17, 0.07], B(0, back + 0.085, -0.01), [-rec, 0, 0], SOFT);
  if (badge) p.decal('cp:badge:' + badge, 0.16, 0.04, B(0, back + 0.08, -0.0865), [-rec, PI, 0], '#e8e4da');
  if (arms) for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.03);
    p.slab(S.frame, x - 0.015, x + 0.015, h - 0.09, h + 0.18, -0.03, 0.03, FLAT);   // (a post at the armrest's middle)
    p.slab(S.arm, x - 0.03, x + 0.03, h + 0.17, h + 0.2, -d / 2 + 0.04, d / 2 - 0.06, { ...SOFT, r: 0.012 });
  }
}

export function jumpSeat(p, o = {}) {
  const { w = 0.44, h = 0.46, open = true, harness = true, look = 'tan' } = o;
  const S = SEAT_LOOK[look] || SEAT_LOOK.tan;
  // the wall frame: a plate with two uprights, a padded back and a headrest on it
  p.slab(S.frame, -w / 2 - 0.035, w / 2 + 0.035, 0.28, 1.4, 0, 0.025, { ...FIRM, cell: 0.6 });
  for (const s of [-1, 1]) p.slab('black', s * (w / 2 + 0.035) - 0.03, s * (w / 2 + 0.035) + 0.03, 0.26, 1.42, 0.0, 0.05, LEAN);
  p.slab(S.pad, -w / 2 + 0.02, w / 2 - 0.02, h + 0.06, h + 0.66, 0.025, 0.085, SOFT);
  p.slab(S.seam, -w / 2 + 0.02, w / 2 - 0.02, h + 0.33, h + 0.36, 0.025, 0.088, { r: 0 });
  p.slab(S.pad, -0.13, 0.13, h + 0.72, h + 0.92, 0.025, 0.09, SOFT);
  // the seat pan on its hinge: down (two struts hold it level) or folded up against the back
  const hinge = [0, h - 0.04, 0.07], dep = 0.4;
  p.cyl('rail', 0.012, w + 0.05, hinge, [0, 0, PI / 2], 10);
  if (open) {
    p.slab(S.frame, -w / 2, w / 2, h - 0.06, h - 0.035, 0.06, 0.06 + dep, FLAT);
    p.slab(S.pad, -w / 2 + 0.01, w / 2 - 0.01, h - 0.04, h, 0.065, 0.06 + dep, SOFT);
    for (const s of [-1, 1]) bar(p, 'black', [s * (w / 2 + 0.006), 0.3, 0.035], [s * (w / 2 - 0.012), h - 0.065, dep - 0.02], 0.018);   // (struts from the uprights' feet)
    p.slab('yellow', -0.05, 0.05, h - 0.06, h - 0.035, 0.06 + dep, 0.07 + dep, { r: 0 });   // (the pull tab)
  } else {
    p.slab(S.frame, -w / 2, w / 2, h - 0.04, h - 0.04 + dep, 0.09, 0.115, FIRM);
    p.slab('yellow', -0.05, 0.05, h - 0.06 + dep, h - 0.035 + dep, 0.09, 0.12, { r: 0 });
  }
  if (harness) for (const s of [-1, 1]) {
    p.slab('black', s * 0.09 - 0.03, s * 0.09 + 0.03, h + 0.62, h + 0.64, 0.025, 0.09, { r: 0 });
    const z = open ? 0.092 : 0.12;
    const end = open ? h + 0.1 : h + 0.42;   // (folded up, the seat covers the back's lower half: the straps stop above it)
    strap(p, S.strap, [[s * 0.09, h + 0.63, 0.09], [s * 0.085, (h + 0.63 + end) / 2, z], [s * 0.075, end, z]], v3(0, 0, 1));
    p.slab('chrome', s * 0.075 - 0.025, s * 0.075 + 0.025, end - 0.03, end + 0.01, z - 0.004, z + 0.008, { r: 0 });
  }
}
