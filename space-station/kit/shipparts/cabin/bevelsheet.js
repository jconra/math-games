// THE BEVEL HELPER'S SHEET (the Kit Lab's "Bevel helper: variants"): one of each thing kit/bevel.js makes, on a dark
// board 3.7 x 1.35 m standing on the floor (its face at z = 0, the variants standing out of it toward +z), in two rows
// of six. A face's relief that sinks needs a face with room to sink into, so each relief stands on a block 3 cm deep
// (a solid with no back, its front face the relief). p.sheet lists each one's name, the triangles of the helper's call
// alone (the block under a relief not counted) and its middle, for the rig that labels the picture.
import { shape, octagon, relief, solid, loft, prism, plate, RINGS, add, tris } from '../../bevel.js';

const S = 0.4;   // (each variant about this big)
export function bevelSheet(p) {
  const list = [], at = (i) => [-1.5 + (i % 6) * 0.6, i < 6 ? 1.1 : 0.45];
  p.slab('dark', -1.85, 1.85, 0.12, 1.45, -0.04, 0, { r: 0, cell: 9, loops: [] });
  const note = (name, n, i) => { const [x, y] = at(i); list.push({ name, tris: n, at: [x, y, 0] }); };
  const show = (name, look, g, i, n = tris(g)) => { const [x, y] = at(i); note(name, n, i); add(p, look, g, [x, y, 0]); };
  // (a relief on its block: the solid's front face carries the rings; counted as the relief alone)
  const onBlock = (name, s, rings, i) => show(name, 'white2', solid(s, 0.05, { edge: 0, back: false, front: rings }), i, tris(relief(s, rings)));
  const sq = shape(S, S, 0.08);
  onBlock('bevel: a raised plateau', sq, RINGS.bevel(0.03, 0.03), 0);
  onBlock('negative bevel: a recess', sq, RINGS.sunk(0.03, 0.03), 1);
  onBlock('border bevel', sq, RINGS.border(0.05, 0.02, 0.02, 0.01), 2);
  onBlock('nested rings: 3 steps in', shape(S, S, 0.1), RINGS.steps(3, 0.035, 0.012, 0.014), 3);
  onBlock('border bevel, square corners', shape(S, S, 0), RINGS.border(0.05, 0.02, 0.02, 0.01), 4);
  show('a frame round an opening (open foot, jamb)', 'black', relief(shape(S, S * 1.1, [0.03, 0.1], 0, 0, 'bottom'), [{ inset: 0, depth: 0.03, bevel: 0.012 }, { inset: 0.02, depth: 0.015, bevel: 0.008 }, { inset: 0.02, depth: -0.005, bevel: 0.01 }, { inset: 0.012, depth: -0.005, bevel: 0 }], { hole: true, jamb: -0.03 }), 5);
  show('solid, chamfered edges', 'white', solid(sq, 0.12, { edge: 0.02 }), 6);
  show('solid with a border-bevel face', 'white', solid(sq, 0.06, { edge: 0.01, front: RINGS.border(0.04, 0.008, 0.01, 0.002) }), 7);
  show('solid, tapered', 'white', solid(shape(S * 0.7, S * 0.7, 0.05), 0.14, { edge: 0.012, taper: shape(S, S, 0.09) }), 8);
  show('loft: a stool\'s waist', 'gun', loft([{ s: shape(0.3, 0.3, 0.07), z: 0 }, { s: shape(0.3, 0.3, 0.07), z: 0.03 }, { s: shape(0.12, 0.12, 0.03), z: 0.16 }, { s: shape(0.26, 0.26, 0.06), z: 0.3 }]), 9);
  show('loft: a pedestal', 'gun', loft([{ s: shape(0.38, 0.38, 0.1), z: 0 }, { s: shape(0.38, 0.38, 0.1), z: 0.02 }, { s: shape(0.2, 0.2, 0.05), z: 0.09 }, { s: shape(0.15, 0.15, 0.04), z: 0.1 }, { s: shape(0.17, 0.17, 0.045), z: 0.3 }]), 10);
  // (a polygon: a door leaf's stepped seam, a field cut from its face and sunk)
  const pts = [[-0.18, -0.2], [0.04, -0.2], [0.04, -0.03], [-0.02, 0.03], [-0.02, 0.1], [0.04, 0.16], [0.04, 0.2], [-0.18, 0.2]], field = shape(0.13, 0.26, 0.03, -0.085, 0);
  const g1 = prism(pts, 0, 0.02, { holes: [octagon(field)] }), g2 = relief(field, RINGS.sunk(0.006, 0.008)), [x, y] = at(11);
  note('prism: a leaf with a stepped seam', tris(g1) + tris(g2), 11); add(p, 'white2', g1, [x, y, 0]); add(p, 'grey2', g2, [x, y, 0.02]);
  // (and a light strip: a plate)
  add(p, 'white', plate(shape(3.4, 0.012, 0.004)), [0, 0.16, 0.002], null, 'glow');
  p.sheet = list;
  return p;
}
