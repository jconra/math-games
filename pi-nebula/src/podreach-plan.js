// REACHING A STASIS POD'S LOCK, the rule alone (plain numbers, no THREE: the tests run it in node; src/podreach.js uses
// it each frame): a pod is offered when its middle is within `reach` metres of the eye and no more than `cone` radians
// off the middle of the view.
//   inReach(eye, forward, at, { reach, cone }) -> true | false   (eye, forward, at: [x, y, z])
//   REACH { reach, cone, tap (how far a press may move, in pixels, and still be a tap) }
export const REACH = { reach: 4.5, cone: 0.4, tap: 6 };

export function inReach(eye, fwd, at, { reach = REACH.reach, cone = REACH.cone } = {}) {
  const d = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], l = Math.hypot(...d);
  if (l > reach) return false;
  if (l < 1e-6) return true;
  const fl = Math.hypot(...fwd) || 1, c = (d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2]) / (l * fl);
  return Math.acos(Math.max(-1, Math.min(1, c))) <= cone;
}

