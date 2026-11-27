// MATHBALL'S CAMERA, as plain numbers (index.js draws it; tests/mathball-hands.test.mjs checks it): main's framing up
// and down, exactly, with only the view's turn made the player's own.
//
// Up and down it is main's: behind the player and above (C.dist, C.height), looking C.ahead past them at C.lookY, the
// look raised by C.holdUp while a ball is in hand (so the far end's goals come down the screen, clear of the score);
// kept inside the court, against a wall it comes in and rises (half a metre for each metre it was pushed); the mouse's
// up-and-down drag (lift) brings it nearer and higher, or further and lower, as on main. index.js eases all of it as
// main eased it.
// Sideways it is the player's (the game's maker, 2026-11-26: "no automatic rotations"): main's camera, pushed sideways
// by a wall, still looked at the same point and so turned the view a little; here the point it looks at moves sideways
// with it, so the view's turn is cam.yaw exactly, always.
import { COURT, clampIn } from './court.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// main's camera for the player at (x, z) in the court's frame, the view's turn yaw, the mouse's tilt lift:
//   back   how far behind the player it would stand (main: C.dist, nearer with lift)
//   shift  [dx, dz]: where the court's walls pushed it (main's clampIn, 0.4 m inside)
//   ay     its height (main's: C.height, + lift, + half of how far it was pushed, under the ceiling)
//   ly     the height it looks at (main's: C.lookY, + C.holdUp with a ball in hand)
export function frame(C, x, z, yaw, lift = 0, holding = false, under = 0.7) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), back = C.dist * (1 - lift * 0.12);
  const ax = x - fx * back, az = z - fz * back, [cx, cz] = clampIn(ax, az, 0.4);
  const shift = [cx - ax, cz - az], pushed = Math.hypot(shift[0], shift[1]);
  return { back, shift, ay: Math.min(C.height + lift * 0.9 + pushed * 0.5, COURT.height - under), ly: C.lookY + (holding ? C.holdUp : 0) };
}
// the camera's place and the point it looks at from a frame's numbers (index.js passes them eased): the eye is main's;
// the look point is main's moved sideways with the eye, so the way it looks across the floor is yaw exactly
export function place(C, x, z, yaw, F) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), along = F.shift[0] * fx + F.shift[1] * fz;
  const sx = F.shift[0] - fx * along, sz = F.shift[1] - fz * along;
  return { eye: [x - fx * F.back + F.shift[0], F.ay, z - fz * F.back + F.shift[1]], look: [x + fx * C.ahead + sx, F.ly, z + fz * C.ahead + sz] };
}
export const pose = (C, x, z, yaw, lift = 0, holding = false, under = 0.7) => place(C, x, z, yaw, frame(C, x, z, yaw, lift, holding, under));
// a point in the court's frame on a screen W x H (CSS px) seen from a pose, vertical field `fov` degrees: [x, y] or
// null (behind the camera)
export function onScreen(p, P, fov, W, H) {
  const f = unit(sub(P.look, P.eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, P.eye);
  const d = dot(v, f); if (d <= 0.05) return null;
  const tv = Math.tan(fov * Math.PI / 360), th = tv * W / H;
  return [(1 + dot(v, r) / (d * th)) / 2 * W, (1 - dot(v, u) / (d * tv)) / 2 * H];
}
