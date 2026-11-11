// LANDING LEGS, from the game's maker's pictures: a heavy dark strut from a mount under the hull, a knee, a shiny
// piston, and a broad pad on the ground.
//   landingLeg(p, { len, out, pad })
//       Frame: the pad's middle on the ground at the origin; the mount's top (against the belly) at y = len. len 0.76
//       (a hull's belly at level -1 on the ship grid; longer for a leg under a wing or a pod), out 0.35 (how far the
//       knee kicks out toward +z: turn the part so it kicks forward or out), pad 0.8 (the pad's width).
import { SHIP } from '../palette.js';
import { Acc } from './facet.js';
import { latheZ, box, bar } from './shapes.js';

export function landingLeg(p, o = {}) {
  const len = o.len ?? 0.76, out = o.out ?? 0.35, pw = o.pad ?? 0.8, acc = new Acc(), T = SHIP.trim, G = SHIP.gun;
  const padH = 0.14, kneeY = Math.max(padH + 0.3, len * 0.55), top = len;
  // the mount: a block against the belly, a hinge under it
  box(acc, T, [-0.3, 0.3], [top - 0.12, top], [-0.3, 0.3]);
  box(acc, G, [-0.18, 0.18], [top - 0.2, top - 0.12], [-0.1, 0.1]);
  // the upper strut, down and out from the hinge to the knee; the knee, a fat joint across
  bar(acc, T, [0, top - 0.16, 0], [0, kneeY, out], 0.26, 0.22);
  latheZ(acc, [[0, 0.17], [0.12, 0.17], [0.12, -0.17], [0, -0.17]], 8, () => G, { axis: 'x', at: [0, kneeY, out] });
  // the lower leg, from the knee down to the ankle over the pad's middle; a piston from the mount down to it
  bar(acc, T, [0, kneeY, out], [0, padH + 0.12, 0], 0.22, 0.2);
  bar(acc, SHIP.chrome, [0, padH + 0.2, -0.04], [0, top - 0.18, -0.16], 0.07, 0.07);
  bar(acc, G, [0, top * 0.62, -0.11], [0, top - 0.18, -0.16], 0.12, 0.12);
  // the ankle and the pad: a broad faceted foot, a dark tread round its edge
  box(acc, G, [-0.12, 0.12], [padH - 0.01, padH + 0.14], [-0.12, 0.12]);
  latheZ(acc, [[0, padH], [pw * 0.32, padH], [pw * 0.5, padH * 0.55], [pw * 0.5, 0.02], [pw * 0.47, 0], [0, 0]], 8, (i) => (i < 2 ? T : SHIP.frame), { axis: 'y' });
  return acc.flush(p);
}
