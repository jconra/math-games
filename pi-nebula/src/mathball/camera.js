// MATHBALL'S CAMERA, as plain numbers (index.js draws it; tests/mathball-hands.test.mjs sweeps it over the court):
// main's framing wherever no wall is near, and beside a wall a camera that comes in rather than turning.
//
// AWAY FROM WALLS it is main's, exactly: behind the player and above (C.dist, C.height), looking C.ahead past them at
// C.lookY, the look raised by C.holdUp while a ball is in hand (so the far end's goals come down the screen, clear of
// the score); the mouse's up-and-down drag (lift) brings it nearer and higher, or further and lower, as on main.
//
// BESIDE A WALL main's camera slid sideways and kept looking at the player, so main's view TURNED by itself, up to 35
// degrees (the game's maker, 2026-11-26: "no automatic rotations"). Here the view's turn stays the hand's (yaw,
// exactly): the camera slides sideways only a little (no more than C.side degrees off the view's line, so the player
// stays well inside the screen's width), takes the rest of the wall's push by coming IN along the view's own line and
// rising as it comes (1 m for each metre; main rose 0.5), and looks at the point C.ahead past the player, slid
// sideways as far as it slid. The sweep (the test) on the three screens: the player is never off a side, her feet
// never under the screen's foot. index.js eases the camera's place in the court and keeps it inside the court every
// frame (follow), so a quick swipe never takes it through a wall.
import { COURT, clampIn, inside } from './court.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const WALL = { keep: 0.4, rise: 1, slideRise: 0.5 };   // m inside the walls; m up for each metre in, and for each metre sideways (main's)

// where the camera should stand and look, for the player at (x, z) in the court's frame, the view's turn yaw, the
// mouse's tilt lift, a ball in hand or not: { eye, look, back, slide } (back: how far behind the player along the
// view's line; slide: how far to the right of that line)
export function target(C, x, z, yaw, lift = 0, holding = false, under = 0.7) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;   // (r: to the view's right)
  const back = C.dist * (1 - lift * 0.12), ay = C.height + lift * 0.9, ly = C.lookY + (holding ? C.holdUp : 0);
  const ok = (b, l) => inside(x - fx * b + rx * l, z - fz * b + rz * l) >= WALL.keep - 1e-9;
  let b = back, l = 0;
  if (!ok(back, 0)) {
    // (the furthest back it can stand with a sideways slide inside C.side degrees of the line; the smallest slide there)
    const t = Math.tan((C.side || 0) * Math.PI / 180);
    let found = false;
    for (b = back; b > 0.15 && !found; b -= 0.02) {
      const lim = t * b;
      for (let i = 0; i <= 20 && !found; i++) { const s = lim * i / 20; if (ok(b, s)) { l = s; found = true; } else if (ok(b, -s)) { l = -s; found = true; } }
      if (found) break;
    }
    // (none: the nearest place inside the court to just behind the player, as it is)
    if (!found) { const [cx, cz] = clampIn(x - fx * 0.15, z - fz * 0.15, WALL.keep); b = -((cx - x) * fx + (cz - z) * fz); l = (cx - x) * rx + (cz - z) * rz; }
  }
  const eye = [x - fx * b + rx * l, Math.min(ay + (back - b) * WALL.rise + Math.abs(l) * WALL.slideRise, COURT.height - under), z - fz * b + rz * l];
  return { eye, look: [x + fx * C.ahead + rx * l, ly, z + fz * C.ahead + rz * l], back: b, slide: l };
}
export const pose = (C, x, z, yaw, lift = 0, holding = false, under = 0.7) => target(C, x, z, yaw, lift, holding, under);

// THE GAME'S EASING (index.js calls it each frame; the test runs it through swipes): the camera's place eased toward
// the target in the court, then kept inside the court; the point it looks at is always along the view's turn from
// there (how far ahead and how far down eased too), so the view never turns but by yaw. k: 1 - exp(-rate * dt).
//   S: { at: [x, y, z], ahead, drop } (null to start at the target)  -> { eye, look }
export function follow(S, T, yaw, k, under = 0.7) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const ahead = Math.hypot(T.look[0] - T.eye[0], T.look[2] - T.eye[2]), drop = T.eye[1] - T.look[1];
  if (!S.at) { S.at = T.eye.slice(); S.ahead = ahead; S.drop = drop; }
  else {
    for (let i = 0; i < 3; i++) S.at[i] += (T.eye[i] - S.at[i]) * k;
    S.ahead += (ahead - S.ahead) * k; S.drop += (drop - S.drop) * k;
  }
  const [cx, cz] = clampIn(S.at[0], S.at[2], WALL.keep); S.at[0] = cx; S.at[2] = cz; S.at[1] = Math.min(S.at[1], COURT.height - under);
  return { eye: S.at.slice(), look: [S.at[0] + fx * S.ahead, S.at[1] - S.drop, S.at[2] + fz * S.ahead] };
}

// a point in the court's frame on a screen W x H (CSS px) seen from a pose, vertical field `fov` degrees: [x, y] or
// null (behind the camera)
export function onScreen(p, P, fov, W, H) {
  const f = unit(sub(P.look, P.eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, P.eye);
  const d = dot(v, f); if (d <= 0.05) return null;
  const tv = Math.tan(fov * Math.PI / 360), th = tv * W / H;
  return [(1 + dot(v, r) / (d * th)) / 2 * W, (1 - dot(v, u) / (d * tv)) / 2 * H];
}
