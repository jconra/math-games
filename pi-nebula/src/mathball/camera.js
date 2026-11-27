// MATHBALL'S CAMERA, as plain numbers (index.js draws it; tests/mathball-hands.test.mjs checks the sum): where it stands
// and where it looks, from the player's place, the view's turn (yaw) and its tilt (lift), both the player's own.
//
// It stands behind the player and above, looking down the court at one resting height (C.raise above C.lookY) that
// never changes by itself, the same with a ball in hand or without (the game's maker: "no automatic rotations"). The
// player's up-and-down drag tilts where it looks (lift, -1 to 1: C.tiltY metres down or up) and it stays there. Near a
// wall it comes in toward the player along its own line (never sideways: that would turn the view) and, on an upright
// phone, rises a little (C.rise metres for each metre it came in): then it goes back exactly as it was.
//
// THE RESTING TILT, BY THE SUM (camera.js pose and onScreen, the court's numbers): from the start spot, the middle and
// under a goal, facing the far goals, on 400 x 860, 860 x 400 and 1280 x 720, the far goals' mouths and signs clear of
// the top bar, and the floor on the screen from no more than 1.75 m ahead of the player's feet (the feet themselves at
// the court's ends: under the screen's foot, as on main with a ball in hand; a drag down shows them).
import { COURT, inside } from './court.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// how far back of the player the camera can stand along its own line, keeping `wall` m inside the court
export function standBack(C, x, z, yaw, wall = 0.4) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let s = C.dist; while (s > 0.2 && inside(x - fx * s, z - fz * s) < wall) s -= 0.05;
  return s;
}
// the camera's place (eye) and the point it looks at, in the court's frame, for the player at (x, z); push: how far in
// from C.dist the walls have it (index.js eases it back out; the sum takes it at once)
export function pose(C, x, z, yaw, lift = 0, push = null, under = 0.7) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const p = push == null ? C.dist - standBack(C, x, z, yaw) : push, back = C.dist - p;
  return {
    eye: [x - fx * back, Math.min(C.height + p * (C.rise || 0), COURT.height - under), z - fz * back],
    look: [x + fx * C.ahead, C.lookY + C.raise + Math.max(-1, Math.min(1, lift)) * C.tiltY, z + fz * C.ahead],
  };
}
// a point in the court's frame on a screen W x H (CSS px) seen from a pose, vertical field `fov` degrees: [x, y] or
// null (behind the camera)
export function onScreen(p, P, fov, W, H) {
  const f = unit(sub(P.look, P.eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, P.eye);
  const d = dot(v, f); if (d <= 0.05) return null;
  const tv = Math.tan(fov * Math.PI / 360), th = tv * W / H;
  return [(1 + dot(v, r) / (d * th)) / 2 * W, (1 - dot(v, u) / (d * tv)) / 2 * H];
}
