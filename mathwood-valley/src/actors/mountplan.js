// GETTING ON AND OFF, the numbers and the plain logic (no three.js, so the tests can read it): what the Mount and
// Dismount clips (and Mount_R, Dismount_R) are, made in Blender by ~/pw/bandit-math/rigs/clips/build_clips.py, and how
// src/actors/seat.js and src/player.js read them. The same numbers are in the build; tests/mount.test.mjs checks they
// hang together and match the clips' lengths in models/people/clips_m.glb and clips_f.glb.
//
//   MOUNTING          the table below
//   MOUNT_CLIPS       the four clips' names
//   weightAt(tab, t)  a weight from one of MOUNTING's [t, w] tables at t (eased between neighbours, held past the ends)
//   smoothKeys(keys, t)   a smooth curve through [t, v] keys that never overshoots (the build's pchip)
//   mountClock(t)     the mount's clock at a time t in the dismount (the dismount is the mount played backward)
//   clipName(up, side)    'Mount', 'Mount_R', 'Dismount' or 'Dismount_R'
//   sidesFor(across, size)    which side to try getting on from first: [1, -1] (the horse's left, as riders mount) or
//                     [-1, 1] when the rider stands clearly on its right (across: metres to its left, size: the horse's)
//   cornersFor(across, along, side, size)   the corners of the horse to walk round to reach the mounting spot on
//                     `side` from (across, along) in the horse's own frame: [[across, along], ...] (none if already on
//                     that side), so the walk never goes through it
//   spotAt(side, scale)   where the standing person's root is at the clip's ground end, from the riding root in the
//                     horse's own frame ([across, up, forward], metres)

// at: the standing person's root (between the feet) where Mount starts and Dismount ends, from the riding root (where
// seatRider puts it) in the horse's own space at full size ([across to its left, up, forward], metres: by the horse's
// left shoulder, on the bay's ground 0.895 m under the riding root); the _R clips mirror it across. face: the way they
// face there, turned from the way the horse faces (rotation.y: toward its side and a little toward its tail).
// mount, dismount: the clips' lengths (s; whole frames at 30 a second). back: the dismount's clock against the mount's
// ([dismount s, mount s]: the leg's swing back over a little quicker than it went, the rest at about the mount's pace).
// The rest is on the mount's clock, [s, weight], eased between: ground, how much the root is put on the real ground (all
// of it while the feet are on it, none once the weight is in the stirrup); feet, each foot standing on the ground (near:
// the one that goes into the stirrup, on the side being mounted; far: the other, which steps back to push from, hops
// once to spring, then swings over); pin, how much each hand and the stirrup foot keep to their places on the horse (so
// a hand stays on the saddle and the foot in the stirrup while the root moves for the ground); out, each leg's share of
// legsOut once its foot is in its stirrup (the bigger horses' wider barrel). rise: the stretch of the mount's clock over
// which the camera's point goes from the feet on the ground to the horse's middle.
export const MOUNTING = {
  at: [0.66, -0.895, 0.55], face: -130 * Math.PI / 180,
  mount: 60 / 30, dismount: 54 / 30,
  back: [[0, 60 / 30], [0.06, 1.90], [0.30, 1.66], [0.60, 1.32], [1.10, 0.76], [1.26, 0.60], [1.52, 0.28], [54 / 30, 0]],
  ground: [[0, 1], [0.84, 1], [1.17, 0]],
  feet: { near: [[0, 1], [0.24, 1], [0.29, 0]], far: [[0, 1], [0.04, 1], [0.07, 0], [0.19, 0], [0.22, 1], [0.63, 1], [0.655, 0], [0.705, 0], [0.73, 1], [0.86, 1], [0.95, 0]] },
  pin: { nearFoot: [[0.24, 0], [0.62, 1], [1.86, 1], [60 / 30, 0]], nearHand: [[0.04, 0], [0.44, 1], [1.65, 1], [1.84, 0]], farHand: [[0.08, 0], [0.46, 1], [1.66, 1], [1.86, 0]] },
  out: { near: [[0.60, 0], [1.32, 1]], far: [[1.77, 0], [1.86, 1]] },
  rise: [0.48, 1.64],
};
export const MOUNT_CLIPS = ['Mount', 'Mount_R', 'Dismount', 'Dismount_R'];
const ease = (t) => t * t * (3 - 2 * t);
export function weightAt(tab, t) {
  if (t <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (t <= tab[i][0]) { const [t0, w0] = tab[i - 1], [t1, w1] = tab[i]; return w0 + (w1 - w0) * ease((t - t0) / (t1 - t0 || 1)); }
  return tab[tab.length - 1][1];
}
export function smoothKeys(keys, t) {
  const n = keys.length; if (t <= keys[0][0]) return keys[0][1]; if (t >= keys[n - 1][0]) return keys[n - 1][1];
  const h = [], d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h.push(keys[i + 1][0] - keys[i][0]); d.push((keys[i + 1][1] - keys[i][1]) / h[i]); }
  for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
  const s = (t - keys[i][0]) / h[i], s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * keys[i][1] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * keys[i + 1][1] + (s3 - s2) * h[i] * m[i + 1];
}
export const mountClock = (t) => smoothKeys(MOUNTING.back, t);
export const clipName = (up, side) => (up ? 'Mount' : 'Dismount') + (side < 0 ? '_R' : '');
export const sidesFor = (across, size = 1) => (across < -0.3 * size ? [-1, 1] : [1, -1]);
// (round the end it is nearer: in front of its middle, round the head; else round the tail)
export function cornersFor(across, along, side, size = 1) {
  if (across * side >= 0.45 * size) return [];
  const end = along >= -0.1 * size ? 1.75 * size : -1.95 * size, path = [];
  if (across * side < -0.45 * size) path.push([-side * 1.0 * size, end]);
  path.push([side * 1.0 * size, end]);
  return path;
}
export const spotAt = (side, scale = 1) => [side * MOUNTING.at[0] * scale, MOUNTING.at[1] * scale, MOUNTING.at[2] * scale];
