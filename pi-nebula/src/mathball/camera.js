// MATHBALL'S CAMERA, as plain numbers (index.js draws it; tests/mathball-hands.test.mjs checks it): main's own camera,
// line for line, driven by the view's turn, which only the player's drag writes (hands.js viewTurn) and a goal button's
// one turn (turnToward).
//
// Main's (65bc920 index.js aim()): behind the player and above (C.dist, C.height), looking C.ahead past them at
// C.lookY, the look raised by C.holdUp while a ball is in hand; the mouse's up-and-down drag (lift) brings it nearer
// and higher, or further and lower; kept inside the court (0.4 m in from the walls), and against a wall it rises half a
// metre for each metre the wall pushed it. Beside a wall, then, it slides along the wall and still looks at the point
// ahead of the player, so the view as drawn turns a little from the hand's turn there, as in the live game, and comes
// back when she steps away (the game's maker's question 4: the camera beside a wall). The place and the point it looks
// at are eased toward these at main's rate (ease).
import { COURT, clampIn } from './court.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// where main's camera stands and looks for the player at (x, z) in the court's frame: { eye, look, pushed } (pushed:
// how far a wall moved it, metres)
export function target(C, x, z, yaw, lift = 0, holding = false, under = 0.7) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const ax = x - fx * C.dist * (1 - lift * 0.12), az = z - fz * C.dist * (1 - lift * 0.12);
  const [cx, cz] = clampIn(ax, az, 0.4), pushed = Math.hypot(cx - ax, cz - az);
  return { eye: [cx, Math.min(C.height + lift * 0.9 + pushed * 0.5, COURT.height - under), cz], look: [x + fx * C.ahead, C.lookY + (holding ? C.holdUp : 0), z + fz * C.ahead], pushed };
}
// main's easing: the camera's place and the point it looks at each moved k of the way to the target (k: 1 -
// exp(-rate dt)). S: { eye, look } (null: start at the target) -> the pose drawn
export function ease(S, T, k) {
  if (!S.eye) { S.eye = T.eye.slice(); S.look = T.look.slice(); }
  else for (let i = 0; i < 3; i++) { S.eye[i] += (T.eye[i] - S.eye[i]) * k; S.look[i] += (T.look[i] - S.look[i]) * k; }
  return { eye: S.eye.slice(), look: S.look.slice() };
}
// a point in the court's frame on a screen W x H (CSS px) seen from a pose, vertical field `fov` degrees: [x, y] or
// null (behind the camera)
export function onScreen(p, P, fov, W, H) {
  const f = unit(sub(P.look, P.eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, P.eye);
  const d = dot(v, f); if (d <= 0.05) return null;
  const tv = Math.tan(fov * Math.PI / 360), th = tv * W / H;
  return [(1 + dot(v, r) / (d * th)) / 2 * W, (1 - dot(v, u) / (d * tv)) / 2 * H];
}
