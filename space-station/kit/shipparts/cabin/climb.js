// HOLDING ON AND CLIMBING: a grab handle on a wall, and a ladder up a wall (to a roof hatch, a bunk, a deck above).
// Frame: against a wall, z = 0 on the wall line (nothing behind FACE), the middle on x = 0.
//   handhold(p, o)  a bare-metal grab bar on two charcoal standoffs: { len (0.4), y (1.2: its middle's height),
//                   upright (false: the bar runs along the wall; true: up it, beside a door) }
//   ladder(p, o)    { h (2.5: deck to the top of its rails), w (0.45: between the rails' middles), pitch (0.28: rung
//                   to rung), out (0.18: the rungs' middle out from the wall's face) }: charcoal rails with
//                   yellow-striped ends, bare-metal rungs, a bracket to the wall at the foot and every 0.8 m
import { FACE } from './ship.js';

const PI = Math.PI;
export function handhold(p, o = {}) {
  const { len = 0.4, y = 1.2, upright = false } = o, out = 0.07, R = 0.016;
  const at = (a, z) => (upright ? [0, y + a, z] : [a, y, z]);
  for (const a of [-len / 2, len / 2]) {
    p.cyl('black', 0.03, 0.012, at(a, FACE + 0.006), [PI / 2, 0, 0], 14);               // its plate on the wall
    p.cyl('black', 0.013, out, at(a, FACE + out / 2), [PI / 2, 0, 0], 10);               // the standoff
  }
  p.cyl('rail', R, len + 0.03, at(0, FACE + out), upright ? null : [0, 0, PI / 2], 12);  // the bar
  for (const a of [-len / 2, len / 2]) p.cyl('black', R + 0.004, 0.03, at(a, FACE + out), upright ? null : [0, 0, PI / 2], 12);
  return p;
}
export function ladder(p, o = {}) {
  const { h = 2.5, w = 0.45, pitch = 0.28, out = 0.18 } = o, z = FACE + out;
  for (const sx of [-1, 1]) {
    const x = sx * w / 2;
    p.slab('black', x - 0.02, x + 0.02, 0, h, z - 0.035, z + 0.035, { r: 0.01, cell: 0.8 });
    // yellow bands where a hand or foot first meets it
    for (const yy of [0.05, h - 0.25]) p.slab('yellow', x - 0.022, x + 0.022, yy, yy + 0.2, z - 0.037, z + 0.037, { r: 0.008 });
    // brackets back to the wall
    for (let y = 0.3; y < h - 0.1; y += 0.8) p.slab('dark', x - 0.015, x + 0.015, y - 0.03, y + 0.03, FACE, z - 0.035, { r: 0.006 });
  }
  for (let y = pitch; y < h - 0.1; y += pitch) {
    p.cyl('rail', 0.016, w - 0.04, [0, y, z], [0, 0, PI / 2], 10);
    p.slab('dark', -w / 2 + 0.06, w / 2 - 0.06, y + 0.012, y + 0.018, z - 0.012, z + 0.012, { r: 0 });   // (a grip strip on top)
  }
  return p;
}
