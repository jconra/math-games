// MATHBALL'S CAMERA, as plain numbers (index.js draws it; tests/mathball-hands.test.mjs sweeps it over the court).
//
// AWAY FROM WALLS it is main's, exactly: behind the player and above (C.dist, C.height), looking C.ahead past them at
// C.lookY, the look raised by C.holdUp while a ball is in hand; the mouse's up-and-down drag (lift) brings it nearer
// and higher, or further and lower, as on main.
//
// BESIDE A WALL it rises above her and never turns by itself (the game's maker, question 4: "Rise above me and never
// turn by itself"): it slides sideways only a little (no more than C.side degrees off the view's line), takes the rest
// of the wall's push by coming IN along the view's own line and rising (1 m for each metre in, half a metre for each
// metre sideways), and looks at the point C.ahead past her, slid sideways as far as it slid. Where it stands is solved
// directly (the furthest back it can stand, 0.4 m inside every wall, within the slide), so it moves smoothly as she
// walks. index.js eases these numbers (her place, how far back, the slide, the heights) and puts the camera along the
// view's turn from them every frame, kept inside the court (follow): the view's turn is always the hand's, exactly.
import { COURT, WALLS, clampIn, inside } from './court.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const WALL = { keep: 0.4, rise: 1, slideRise: 0.5, least: 0.15 };   // m inside the walls; m up a metre in, a metre sideways; nearest it comes

// where the camera should stand: { back, slide } for the player at (x, z) in the court's frame and the view's turn yaw:
// the largest `back` (up to C.dist with the mouse's lift) with some slide |l| <= tan(C.side) * back keeping the eye
// WALL.keep inside every wall, and of those slides the smallest. Each wall is a straight line in (back, slide), so this
// is the highest corner of a small polygon: found by trying the corners
export function stand(C, x, z, yaw, lift = 0) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx, back = C.dist * (1 - lift * 0.12), t = Math.tan((C.side || 0) * Math.PI / 180);
  // each limit as a * b + c * l <= d
  const L = WALLS.map((W) => { const nf = W.n[0] * fx + W.n[1] * fz, nr = W.n[0] * rx + W.n[1] * rz; return [nf, -nr, W.n[0] * (x - W.A[0]) + W.n[1] * (z - W.A[1]) - WALL.keep]; });
  L.push([-t, 1, 0], [-t, -1, 0], [1, 0, back], [-1, 0, -WALL.least]);
  const ok = (b, l) => L.every(([a, c, d]) => a * b + c * l <= d + 1e-9);
  if (ok(back, 0)) return { back, slide: 0 };
  let best = null;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const [a1, c1, d1] = L[i], [a2, c2, d2] = L[j], det = a1 * c2 - a2 * c1; if (Math.abs(det) < 1e-12) continue;
    const b = (d1 * c2 - d2 * c1) / det, l = (a1 * d2 - a2 * d1) / det;
    if (ok(b, l) && (!best || b > best.back + 1e-9)) best = { back: b, slide: l };
  }
  if (!best) {   // (no room within the slide: the nearest place inside the court to just behind her)
    const [cx, cz] = clampIn(x - fx * WALL.least, z - fz * WALL.least, WALL.keep);
    return { back: -((cx - x) * fx + (cz - z) * fz), slide: (cx - x) * rx + (cz - z) * rz };
  }
  // (at that back, the slide nearest the view's line)
  let lo = -Infinity, hi = Infinity;
  for (const [a, c, d] of L) { if (Math.abs(c) < 1e-12) continue; const v = (d - a * best.back) / c; if (c > 0) hi = Math.min(hi, v); else lo = Math.max(lo, v); }
  return { back: best.back, slide: Math.max(lo, Math.min(hi, 0)) };
}
// the numbers it eases toward, and the pose they give, for the player at (x, z): { back, slide, ay, ly, eye, look }
export function target(C, x, z, yaw, lift = 0, holding = false, under = 0.7) {
  const S = stand(C, x, z, yaw, lift), back0 = C.dist * (1 - lift * 0.12);
  const ay = rise(C, lift, S.back, S.slide, under);
  const N = { back: S.back, slide: S.slide, ay, ly: C.lookY + (holding ? C.holdUp : 0) };
  return { ...N, ...place(C, x, z, yaw, N) };
}
// how high it stands for how far back and how far slid: main's height, rising 1 m for each metre it came in and half
// a metre for each metre sideways (worked out from the eased numbers each frame, so the height always matches them)
export const rise = (C, lift, back, slide, under = 0.7) => Math.min(C.height + lift * 0.9 + Math.max(0, C.dist * (1 - lift * 0.12) - back) * WALL.rise + Math.abs(slide) * WALL.slideRise, COURT.height - under);
// the pose from the numbers: the eye along the view's turn from her place; the point it looks at C.ahead past her,
// slid as the eye slid
export function place(C, x, z, yaw, N) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
  return { eye: [x - fx * N.back + rx * N.slide, N.ay, z - fz * N.back + rz * N.slide], look: [x + fx * C.ahead + rx * N.slide, N.ly, z + fz * C.ahead + rz * N.slide] };
}
export const pose = (C, x, z, yaw, lift = 0, holding = false, under = 0.7) => { const T = target(C, x, z, yaw, lift, holding, under); return { eye: T.eye, look: T.look }; };

// THE GAME'S EASING (index.js calls it each frame; the tests run it through swipes): her place and the camera's numbers
// eased k of the way (k: 1 - exp(-rate dt)), the camera put along the view's turn from them, then kept inside the court
// (the point it looks at moved with it, so the view never turns but by yaw); its height from the eased numbers (rise).
// S: { x, z, back, slide, ay, ly } (x
// undefined to start at the target) -> { eye, look }
export function follow(S, C, x, z, yaw, lift, holding, k, under = 0.7) {
  if (S.x == null) { S.x = x; S.z = z; } else { S.x += (x - S.x) * k; S.z += (z - S.z) * k; }
  const T = target(C, S.x, S.z, yaw, lift, holding, under);
  if (S.back == null) { S.back = T.back; S.slide = T.slide; S.ly = T.ly; }
  else for (const key of ['back', 'slide', 'ly']) S[key] += (T[key] - S[key]) * k;
  S.ay = rise(C, lift, S.back, S.slide, under);
  let P = place(C, S.x, S.z, yaw, S);
  // (a quick turn beside a wall: the eased numbers would put it through the wall, so they are brought toward the
  // target, which is inside, only as far as that takes; sliding the eye instead would slide her off the screen)
  if (inside(P.eye[0], P.eye[2]) < WALL.keep - 1e-6) {
    let lo = 0, hi = 1;
    const at = (t) => place(C, S.x, S.z, yaw, { back: S.back + (T.back - S.back) * t, slide: S.slide + (T.slide - S.slide) * t, ay: 0, ly: S.ly });
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (inside(at(m).eye[0], at(m).eye[2]) >= WALL.keep - 1e-6) hi = m; else lo = m; }
    S.back += (T.back - S.back) * hi; S.slide += (T.slide - S.slide) * hi; S.ay = rise(C, lift, S.back, S.slide, under); P = place(C, S.x, S.z, yaw, S);
  }
  const [cx, cz] = clampIn(P.eye[0], P.eye[2], WALL.keep), dx = cx - P.eye[0], dz = cz - P.eye[2];
  return { eye: [cx, Math.min(P.eye[1], COURT.height - under), cz], look: [P.look[0] + dx, P.look[1], P.look[2] + dz] };
}

// a point in the court's frame on a screen W x H (CSS px) seen from a pose, vertical field `fov` degrees: [x, y] or
// null (behind the camera)
export function onScreen(p, P, fov, W, H) {
  const f = unit(sub(P.look, P.eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, P.eye);
  const d = dot(v, f); if (d <= 0.05) return null;
  const tv = Math.tan(fov * Math.PI / 360), th = tv * W / H;
  return [(1 + dot(v, r) / (d * th)) / 2 * W, (1 - dot(v, u) / (d * tv)) / 2 * H];
}
