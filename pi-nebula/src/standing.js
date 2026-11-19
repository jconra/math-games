// WHERE A SHIP STANDS, in plain numbers: no page and no three.js, so node tests it (tests/flying.test.mjs).
//
// THE GAME'S MAKER (2026-11-18): "if the pilot sets down and is still crooked then I would hope the crane can just
// compensate for it. ... Even if they just come straight in and land it nose-in, that should be okay ... Once they leave
// the hanger and come back then the ship should be reset in it's proper parking spot."
//
// A ship set down by hand stands on its legs somewhere on its hangar's floor, turned whichever way round: never tipped.
// So where it stands is ONE MOVE from where it is parked, a turn about straight up and a move across the floor, kept as
// a matrix (16 numbers, column by column, as three.js keeps a Matrix4's `elements`). Everything that has to follow the
// ship is moved by that one matrix and nothing else: the ship as it is drawn and its cabin (src/crane.js,
// src/boarding.js), the walls a person feels (src/walls.js: asked in the ship's own frame, frameOf below), the crane's
// places on the ship (kit/crane-plan.js moveMounts). This file is the sums they share, so they cannot disagree.
//
//   standElements(at, pad)   the move, from the flight model's own words for where a ship stands ({ p, q }:
//                            src/flymodel.js standOf; pad: where it is parked). null: parked, no move at all
//   frameOf(e)               the move as walls.js keeps it: { c, s, x, y, z } (the turn's cosine and sine, the move)
//   into(fr, x, z)           a point of the station, in the ship's own frame (where the ship is parked): [x, z]
//   outOf(fr, x, z)          a point of the ship where it is parked, where the ship stands: [x, z]
//   yawOf(e)                 how far it is turned (radians, as three.js turns about y: nose out of the door is 0)
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// at: { p: [x, y, z] where the point of the ship that stands on its pad's middle now is, q: [x, y, z, w] how it is
// turned (level: only about straight up) }. The matrix is T(p) R(q) T(-pad): the pad's middle goes to p.
export function standElements(at, pad) {
  if (!at) return null;
  const [qx, qy, qz, qw] = at.q, L = Math.hypot(qy, qw) || 1, y = qy / L, w = qw / L;
  if (Math.abs(qx) > 1e-6 || Math.abs(qz) > 1e-6) throw new Error('standing: a ship on its legs is only turned about straight up');
  const c = 1 - 2 * y * y, s = 2 * y * w;      // (the turn about y by a: x' = c x + s z, z' = -s x + c z)
  const tx = at.p[0] - (c * pad[0] + s * pad[2]), ty = at.p[1] - pad[1], tz = at.p[2] - (-s * pad[0] + c * pad[2]);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, tx, ty, tz, 1];
}
export const frameOf = (e) => (e ? { c: e[0], s: e[8], x: e[12], y: e[13], z: e[14] } : null);
export const yawOf = (e) => (e ? Math.atan2(e[8], e[0]) : 0);
export function into(fr, x, z) { if (!fr) return [x, z]; const dx = x - fr.x, dz = z - fr.z; return [fr.c * dx - fr.s * dz, fr.s * dx + fr.c * dz]; }
export function outOf(fr, x, z) { return fr ? [fr.c * x + fr.s * z + fr.x, -fr.s * x + fr.c * z + fr.z] : [x, z]; }
// is the move no move at all? (parked)
export const isParked = (e) => !e || e.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-9);
